"""Stripe Billing Integration

This module handles Stripe subscription management:
- Customer creation
- Subscription management
- Webhook handling
- Usage tracking
"""

import os
import logging
from typing import Optional, Dict, Any, Literal
from datetime import datetime

import stripe

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

# Subscription tier configuration
TIER_CONFIG = {
    "free": {
        "price_id": None,  # No Stripe price for free tier
        "analysis_limit": 5,
        "team_limit": 1,
        "features": ["basic_analysis", "clearcast_basic"]
    },
    "pro": {
        "price_id": os.environ.get("STRIPE_PRICE_PRO"),
        "analysis_limit": 50,
        "team_limit": 5,
        "features": [
            "basic_analysis", "clearcast_basic", "ad_script_lab",
            "storyboards", "media_reports", "priority_support"
        ]
    },
    "enterprise": {
        "price_id": os.environ.get("STRIPE_PRICE_ENTERPRISE"),
        "analysis_limit": -1,  # Unlimited
        "team_limit": -1,  # Unlimited
        "features": [
            "basic_analysis", "clearcast_basic", "ad_script_lab",
            "storyboards", "media_reports", "priority_support",
            "api_access", "dedicated_support", "custom_integrations"
        ]
    }
}

SubscriptionTier = Literal["free", "pro", "enterprise"]


# =============================================================================
# Customer Management
# =============================================================================

async def create_stripe_customer(
    email: str,
    name: str,
    organization_id: str,
    metadata: Optional[Dict[str, str]] = None
) -> str:
    """
    Create a Stripe customer for an organization.

    Args:
        email: Billing email
        name: Organization name
        organization_id: Our internal organization ID
        metadata: Additional metadata

    Returns:
        Stripe customer ID
    """
    try:
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={
                "organization_id": organization_id,
                **(metadata or {})
            }
        )
        logger.info(f"Created Stripe customer {customer.id} for org {organization_id}")
        return customer.id

    except stripe.error.StripeError as e:
        logger.error(f"Failed to create Stripe customer: {e}")
        raise


async def get_or_create_customer(
    db,
    organization_id: str,
    email: str,
    name: str
) -> str:
    """
    Get existing Stripe customer or create a new one.

    Args:
        db: Supabase client
        organization_id: Organization ID
        email: Billing email
        name: Organization name

    Returns:
        Stripe customer ID
    """
    # Check if organization already has a Stripe customer
    result = db.table("organizations").select(
        "stripe_customer_id"
    ).eq("id", organization_id).single().execute()

    if result.data and result.data.get("stripe_customer_id"):
        return result.data["stripe_customer_id"]

    # Create new customer
    customer_id = await create_stripe_customer(email, name, organization_id)

    # Store customer ID
    db.table("organizations").update({
        "stripe_customer_id": customer_id
    }).eq("id", organization_id).execute()

    return customer_id


# =============================================================================
# Subscription Management
# =============================================================================

async def create_checkout_session(
    db,
    organization_id: str,
    tier: SubscriptionTier,
    success_url: str,
    cancel_url: str
) -> str:
    """
    Create a Stripe Checkout session for subscription.

    Args:
        db: Supabase client
        organization_id: Organization subscribing
        tier: Subscription tier to purchase
        success_url: Redirect URL on success
        cancel_url: Redirect URL on cancel

    Returns:
        Checkout session URL
    """
    if tier == "free":
        raise ValueError("Cannot create checkout for free tier")

    price_id = TIER_CONFIG[tier]["price_id"]
    if not price_id:
        raise ValueError(f"Price ID not configured for tier: {tier}")

    # Get organization and customer
    result = db.table("organizations").select(
        "id, name, stripe_customer_id"
    ).eq("id", organization_id).single().execute()

    if not result.data:
        raise ValueError("Organization not found")

    org = result.data
    customer_id = org.get("stripe_customer_id")

    # Create customer if needed
    if not customer_id:
        # Get owner email
        owner_result = db.table("users").select("email").eq(
            "organization_id", organization_id
        ).eq("role", "owner").single().execute()

        owner_email = owner_result.data["email"] if owner_result.data else "billing@example.com"
        customer_id = await get_or_create_customer(db, organization_id, owner_email, org["name"])

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"organization_id": organization_id, "tier": tier}
        )
        return session.url

    except stripe.error.StripeError as e:
        logger.error(f"Failed to create checkout session: {e}")
        raise


async def create_portal_session(
    db,
    organization_id: str,
    return_url: str
) -> str:
    """
    Create a Stripe Customer Portal session for subscription management.

    Args:
        db: Supabase client
        organization_id: Organization ID
        return_url: URL to return to after portal

    Returns:
        Portal session URL
    """
    result = db.table("organizations").select(
        "stripe_customer_id"
    ).eq("id", organization_id).single().execute()

    if not result.data or not result.data.get("stripe_customer_id"):
        raise ValueError("No Stripe customer for organization")

    try:
        session = stripe.billing_portal.Session.create(
            customer=result.data["stripe_customer_id"],
            return_url=return_url
        )
        return session.url

    except stripe.error.StripeError as e:
        logger.error(f"Failed to create portal session: {e}")
        raise


async def cancel_subscription(db, organization_id: str) -> bool:
    """
    Cancel an organization's subscription (at period end).

    Args:
        db: Supabase client
        organization_id: Organization ID

    Returns:
        True if successful
    """
    result = db.table("organizations").select(
        "stripe_customer_id"
    ).eq("id", organization_id).single().execute()

    if not result.data or not result.data.get("stripe_customer_id"):
        return False

    try:
        # Get active subscriptions
        subscriptions = stripe.Subscription.list(
            customer=result.data["stripe_customer_id"],
            status="active"
        )

        for sub in subscriptions.data:
            stripe.Subscription.modify(
                sub.id,
                cancel_at_period_end=True
            )

        return True

    except stripe.error.StripeError as e:
        logger.error(f"Failed to cancel subscription: {e}")
        return False


# =============================================================================
# Webhook Handling
# =============================================================================

def verify_webhook_signature(payload: bytes, signature: str) -> Dict[str, Any]:
    """
    Verify Stripe webhook signature and parse event.

    Args:
        payload: Raw request body
        signature: Stripe-Signature header

    Returns:
        Parsed Stripe event

    Raises:
        ValueError: If signature is invalid
    """
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

    if not webhook_secret:
        raise ValueError("STRIPE_WEBHOOK_SECRET not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, signature, webhook_secret
        )
        return event

    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise ValueError("Invalid webhook signature")


async def handle_webhook_event(db, event: Dict[str, Any]) -> None:
    """
    Handle a Stripe webhook event.

    Args:
        db: Supabase client
        event: Parsed Stripe event
    """
    event_type = event["type"]
    data = event["data"]["object"]

    logger.info(f"Processing Stripe webhook: {event_type}")

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(db, data)

    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(db, data)

    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(db, data)

    elif event_type == "invoice.payment_failed":
        await _handle_payment_failed(db, data)

    elif event_type == "invoice.paid":
        await _handle_invoice_paid(db, data)


async def _handle_checkout_completed(db, session: Dict[str, Any]) -> None:
    """Handle successful checkout completion"""
    organization_id = session.get("metadata", {}).get("organization_id")
    tier = session.get("metadata", {}).get("tier", "pro")

    if not organization_id:
        logger.warning("Checkout completed without organization_id")
        return

    config = TIER_CONFIG.get(tier, TIER_CONFIG["pro"])

    db.table("organizations").update({
        "subscription_tier": tier,
        "subscription_status": "active",
        "monthly_analysis_limit": config["analysis_limit"],
        "monthly_analyses_used": 0  # Reset on new subscription
    }).eq("id", organization_id).execute()

    logger.info(f"Organization {organization_id} upgraded to {tier}")


async def _handle_subscription_updated(db, subscription: Dict[str, Any]) -> None:
    """Handle subscription updates (upgrades, downgrades)"""
    customer_id = subscription.get("customer")

    # Find organization by customer ID
    result = db.table("organizations").select("id").eq(
        "stripe_customer_id", customer_id
    ).single().execute()

    if not result.data:
        return

    organization_id = result.data["id"]

    # Determine tier from price
    price_id = subscription["items"]["data"][0]["price"]["id"] if subscription.get("items") else None

    tier = "free"
    for t, config in TIER_CONFIG.items():
        if config.get("price_id") == price_id:
            tier = t
            break

    config = TIER_CONFIG[tier]
    status = "active" if subscription["status"] == "active" else subscription["status"]

    db.table("organizations").update({
        "subscription_tier": tier,
        "subscription_status": status,
        "monthly_analysis_limit": config["analysis_limit"]
    }).eq("id", organization_id).execute()


async def _handle_subscription_deleted(db, subscription: Dict[str, Any]) -> None:
    """Handle subscription cancellation"""
    customer_id = subscription.get("customer")

    result = db.table("organizations").select("id").eq(
        "stripe_customer_id", customer_id
    ).single().execute()

    if not result.data:
        return

    # Downgrade to free
    db.table("organizations").update({
        "subscription_tier": "free",
        "subscription_status": "canceled",
        "monthly_analysis_limit": TIER_CONFIG["free"]["analysis_limit"]
    }).eq("id", result.data["id"]).execute()


async def _handle_payment_failed(db, invoice: Dict[str, Any]) -> None:
    """Handle failed payment"""
    customer_id = invoice.get("customer")

    result = db.table("organizations").select("id").eq(
        "stripe_customer_id", customer_id
    ).single().execute()

    if result.data:
        db.table("organizations").update({
            "subscription_status": "past_due"
        }).eq("id", result.data["id"]).execute()


async def _handle_invoice_paid(db, invoice: Dict[str, Any]) -> None:
    """Handle successful payment (reset monthly usage)"""
    customer_id = invoice.get("customer")

    result = db.table("organizations").select("id").eq(
        "stripe_customer_id", customer_id
    ).single().execute()

    if result.data:
        db.table("organizations").update({
            "subscription_status": "active",
            "monthly_analyses_used": 0  # Reset on payment
        }).eq("id", result.data["id"]).execute()


# =============================================================================
# Usage Checking
# =============================================================================

def get_tier_config(tier: SubscriptionTier) -> Dict[str, Any]:
    """Get configuration for a subscription tier"""
    return TIER_CONFIG.get(tier, TIER_CONFIG["free"])


def has_feature(tier: SubscriptionTier, feature: str) -> bool:
    """Check if a tier has access to a feature"""
    config = get_tier_config(tier)
    return feature in config.get("features", [])


def get_analysis_limit(tier: SubscriptionTier) -> int:
    """Get monthly analysis limit for tier (-1 = unlimited)"""
    return get_tier_config(tier).get("analysis_limit", 5)


def get_team_limit(tier: SubscriptionTier) -> int:
    """Get team member limit for tier (-1 = unlimited)"""
    return get_tier_config(tier).get("team_limit", 1)
