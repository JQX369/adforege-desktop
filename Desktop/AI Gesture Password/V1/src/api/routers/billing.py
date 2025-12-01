"""Billing Router

Handles Stripe subscription management and webhooks.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel
from typing import Optional, Literal
import logging

from api.deps import (
    DB, User, Org, OwnerOnly,
    get_current_user, get_current_organization, get_db
)
from app.core.billing import (
    create_checkout_session,
    create_portal_session,
    cancel_subscription,
    verify_webhook_signature,
    handle_webhook_event,
    get_tier_config,
    TIER_CONFIG
)

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Models
# =============================================================================

class SubscriptionResponse(BaseModel):
    tier: str
    status: str
    monthly_limit: int
    monthly_used: int
    features: list[str]


class CheckoutRequest(BaseModel):
    tier: Literal["pro", "enterprise"]
    success_url: str
    cancel_url: str


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


class PricingTier(BaseModel):
    name: str
    price: str
    price_monthly: int
    features: list[str]
    analysis_limit: int
    team_limit: int
    highlighted: bool = False


# =============================================================================
# Subscription Info
# =============================================================================

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization)
):
    """Get current subscription details"""
    config = get_tier_config(org.subscription_tier)

    return SubscriptionResponse(
        tier=org.subscription_tier,
        status=org.subscription_status,
        monthly_limit=org.monthly_analysis_limit,
        monthly_used=org.monthly_analyses_used,
        features=config.get("features", [])
    )


@router.get("/usage")
async def get_usage(
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get detailed usage statistics"""
    from datetime import datetime

    # Get usage breakdown
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0)

    # Analyses this month
    analyses_result = db.table("analyses").select(
        "id", count="exact"
    ).eq("organization_id", org.id).gte(
        "created_at", month_start.isoformat()
    ).execute()

    # Scripts this month (if Ad Script Lab is used)
    scripts_result = db.table("ad_scripts").select(
        "id", count="exact"
    ).eq("organization_id", org.id).gte(
        "created_at", month_start.isoformat()
    ).execute()

    # Storyboards this month
    storyboards_result = db.table("storyboards").select(
        "id", count="exact"
    ).eq("organization_id", org.id).gte(
        "created_at", month_start.isoformat()
    ).execute()

    return {
        "period": {
            "start": month_start.isoformat(),
            "end": None  # Current month
        },
        "analyses": {
            "used": analyses_result.count or 0,
            "limit": org.monthly_analysis_limit,
            "unlimited": org.subscription_tier == "enterprise"
        },
        "scripts": {
            "used": scripts_result.count or 0,
            "available": org.subscription_tier in ("pro", "enterprise")
        },
        "storyboards": {
            "used": storyboards_result.count or 0,
            "available": org.subscription_tier in ("pro", "enterprise")
        },
        "team_members": {
            "current": 0,  # Would need to count
            "limit": get_tier_config(org.subscription_tier).get("team_limit", 1)
        }
    }


# =============================================================================
# Pricing
# =============================================================================

@router.get("/pricing", response_model=list[PricingTier])
async def get_pricing():
    """Get pricing tiers (public endpoint)"""
    return [
        PricingTier(
            name="Free",
            price="£0",
            price_monthly=0,
            features=[
                "5 video analyses per month",
                "Basic Clearcast compliance check",
                "1 team member",
                "30-day data retention"
            ],
            analysis_limit=5,
            team_limit=1
        ),
        PricingTier(
            name="Pro",
            price="£49",
            price_monthly=49,
            features=[
                "50 video analyses per month",
                "Full Clearcast compliance suite",
                "Ad Script Lab",
                "Storyboard generation",
                "Media report parsing (10/mo)",
                "5 team members",
                "Email support",
                "1-year data retention"
            ],
            analysis_limit=50,
            team_limit=5,
            highlighted=True
        ),
        PricingTier(
            name="Enterprise",
            price="£199",
            price_monthly=199,
            features=[
                "Unlimited video analyses",
                "Full Clearcast compliance suite",
                "Ad Script Lab",
                "Storyboard generation",
                "Unlimited media reports",
                "Unlimited team members",
                "API access",
                "Dedicated support",
                "Unlimited data retention",
                "Custom integrations"
            ],
            analysis_limit=-1,
            team_limit=-1
        )
    ]


# =============================================================================
# Checkout & Portal
# =============================================================================

@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CheckoutRequest,
    user: User = Depends(OwnerOnly),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Create a Stripe Checkout session for subscription upgrade.

    Only organization owners can manage billing.
    """
    if org.subscription_tier == request.tier:
        raise HTTPException(
            status_code=400,
            detail=f"Already on {request.tier} plan"
        )

    try:
        checkout_url = await create_checkout_session(
            db=db,
            organization_id=org.id,
            tier=request.tier,
            success_url=request.success_url,
            cancel_url=request.cancel_url
        )

        return CheckoutResponse(checkout_url=checkout_url)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Checkout creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout")


@router.post("/portal", response_model=PortalResponse)
async def create_customer_portal(
    return_url: str,
    user: User = Depends(OwnerOnly),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Create a Stripe Customer Portal session.

    The portal allows customers to:
    - View invoices
    - Update payment method
    - Cancel subscription
    """
    try:
        portal_url = await create_portal_session(
            db=db,
            organization_id=org.id,
            return_url=return_url
        )

        return PortalResponse(portal_url=portal_url)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Portal creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create portal")


@router.post("/cancel")
async def cancel_current_subscription(
    user: User = Depends(OwnerOnly),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Cancel the current subscription.

    The subscription will remain active until the end of the billing period.
    """
    if org.subscription_tier == "free":
        raise HTTPException(status_code=400, detail="No active subscription")

    success = await cancel_subscription(db, org.id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")

    return {
        "message": "Subscription will be cancelled at end of billing period",
        "current_tier": org.subscription_tier
    }


# =============================================================================
# Webhook
# =============================================================================

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(..., alias="stripe-signature"),
    db: DB = Depends()
):
    """
    Handle Stripe webhook events.

    Events handled:
    - checkout.session.completed: Subscription created
    - customer.subscription.updated: Plan changed
    - customer.subscription.deleted: Subscription cancelled
    - invoice.payment_failed: Payment failed
    - invoice.paid: Payment succeeded (reset monthly usage)
    """
    # Get raw body for signature verification
    body = await request.body()

    try:
        event = verify_webhook_signature(body, stripe_signature)
    except ValueError as e:
        logger.warning(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        await handle_webhook_event(db, event)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook handling failed: {e}")
        # Return 200 to prevent Stripe from retrying
        # Log the error for investigation
        return {"status": "error", "message": str(e)}


# =============================================================================
# Invoice History
# =============================================================================

@router.get("/invoices")
async def list_invoices(
    user: User = Depends(OwnerOnly),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get invoice history from Stripe"""
    import stripe

    result = db.table("organizations").select(
        "stripe_customer_id"
    ).eq("id", org.id).single().execute()

    if not result.data or not result.data.get("stripe_customer_id"):
        return {"invoices": []}

    try:
        invoices = stripe.Invoice.list(
            customer=result.data["stripe_customer_id"],
            limit=12
        )

        return {
            "invoices": [
                {
                    "id": inv.id,
                    "number": inv.number,
                    "amount": inv.amount_paid / 100,  # Convert from cents
                    "currency": inv.currency.upper(),
                    "status": inv.status,
                    "created": inv.created,
                    "pdf_url": inv.invoice_pdf,
                    "hosted_url": inv.hosted_invoice_url
                }
                for inv in invoices.data
            ]
        }

    except Exception as e:
        logger.error(f"Failed to fetch invoices: {e}")
        return {"invoices": [], "error": "Failed to fetch invoices"}
