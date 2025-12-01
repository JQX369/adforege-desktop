/**
 * Billing Settings Page
 *
 * Allows users to view and manage their subscription, usage, and invoices.
 */

import { useState, useEffect } from 'react';
import { useAuth, useSubscription } from '@features/auth';
import { api } from '@lib/services/api';

interface PricingTier {
  name: string;
  price: string;
  price_monthly: number;
  features: string[];
  analysis_limit: number;
  team_limit: number;
  highlighted?: boolean;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  pdf_url?: string;
  hosted_url?: string;
}

interface UsageData {
  period: { start: string; end: string | null };
  analyses: { used: number; limit: number; unlimited: boolean };
  scripts: { used: number; available: boolean };
  storyboards: { used: number; available: boolean };
  team_members: { current: number; limit: number };
}

export function BillingSettings() {
  const { organization, refreshOrganization, profile } = useAuth();
  const subscription = useSubscription();

  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = profile?.role === 'owner';

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [pricingRes, usageRes, invoicesRes] = await Promise.all([
        api.get('/billing/pricing'),
        api.get('/billing/usage'),
        isOwner ? api.get('/billing/invoices') : Promise.resolve({ invoices: [] }),
      ]);

      setPricingTiers(pricingRes);
      setUsage(usageRes);
      setInvoices(invoicesRes.invoices || []);
    } catch (err) {
      setError('Failed to load billing information');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (!isOwner) {
      setError('Only organization owners can manage billing');
      return;
    }

    setIsUpgrading(true);
    setError(null);

    try {
      const response = await api.post('/billing/checkout', {
        tier,
        success_url: `${window.location.origin}/settings?tab=billing&success=true`,
        cancel_url: `${window.location.origin}/settings?tab=billing&canceled=true`,
      });

      // Redirect to Stripe Checkout
      window.location.href = response.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!isOwner) {
      setError('Only organization owners can manage billing');
      return;
    }

    try {
      const response = await api.post('/billing/portal', {
        return_url: `${window.location.origin}/settings?tab=billing`,
      });

      // Redirect to Stripe Customer Portal
      window.location.href = response.portal_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
  };

  const handleCancelSubscription = async () => {
    if (!isOwner) {
      setError('Only organization owners can manage billing');
      return;
    }

    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }

    setIsCanceling(true);
    setError(null);

    try {
      await api.post('/billing/cancel');
      await refreshOrganization();
      alert('Your subscription has been canceled and will end at the current billing period.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsCanceling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Current Plan */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4">Current Plan</h3>
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h4 className="text-xl font-bold text-white capitalize">
                  {subscription.tier}
                </h4>
                {subscription.isActive && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                    Active
                  </span>
                )}
              </div>
              <p className="text-gray-400 mt-1">
                {subscription.tier === 'free'
                  ? 'Basic features for individuals'
                  : subscription.tier === 'pro'
                  ? 'Advanced features for growing teams'
                  : 'Unlimited power for enterprises'}
              </p>
            </div>

            {isOwner && subscription.tier !== 'free' && (
              <button
                onClick={handleManageBilling}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Manage Billing
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Usage */}
      {usage && (
        <section>
          <h3 className="text-lg font-semibold text-white mb-4">Usage This Month</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Analyses */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Video Analyses</span>
                <span className="text-white font-semibold">
                  {usage.analyses.unlimited
                    ? `${usage.analyses.used} / Unlimited`
                    : `${usage.analyses.used} / ${usage.analyses.limit}`}
                </span>
              </div>
              {!usage.analyses.unlimited && (
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (usage.analyses.used / usage.analyses.limit) * 100
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Scripts */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Ad Scripts</span>
                <span className="text-white font-semibold">
                  {usage.scripts.available ? usage.scripts.used : 'Not available'}
                </span>
              </div>
              {!usage.scripts.available && (
                <p className="text-xs text-gray-500">Upgrade to Pro to access</p>
              )}
            </div>

            {/* Storyboards */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Storyboards</span>
                <span className="text-white font-semibold">
                  {usage.storyboards.available
                    ? usage.storyboards.used
                    : 'Not available'}
                </span>
              </div>
              {!usage.storyboards.available && (
                <p className="text-xs text-gray-500">Upgrade to Pro to access</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Pricing Tiers */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricingTiers.map((tier) => {
            const isCurrentTier =
              tier.name.toLowerCase() === subscription.tier;
            const canUpgrade =
              tier.name.toLowerCase() !== 'free' &&
              tier.name.toLowerCase() !== subscription.tier &&
              (subscription.tier === 'free' ||
                (subscription.tier === 'pro' &&
                  tier.name.toLowerCase() === 'enterprise'));

            return (
              <div
                key={tier.name}
                className={`bg-gray-800/50 rounded-xl border p-6 ${
                  tier.highlighted
                    ? 'border-blue-500'
                    : isCurrentTier
                    ? 'border-green-500'
                    : 'border-gray-700'
                }`}
              >
                {tier.highlighted && (
                  <div className="text-blue-400 text-xs font-semibold mb-2">
                    MOST POPULAR
                  </div>
                )}

                <h4 className="text-xl font-bold text-white">{tier.name}</h4>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-white">
                    {tier.price}
                  </span>
                  {tier.price_monthly > 0 && (
                    <span className="text-gray-400">/month</span>
                  )}
                </div>

                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <svg
                        className="w-5 h-5 text-green-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrentTier ? (
                  <button
                    disabled
                    className="w-full py-2 px-4 bg-green-500/20 text-green-400 rounded-lg cursor-default"
                  >
                    Current Plan
                  </button>
                ) : canUpgrade && isOwner ? (
                  <button
                    onClick={() => handleUpgrade(tier.name.toLowerCase())}
                    disabled={isUpgrading}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                      tier.highlighted
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    {isUpgrading ? 'Loading...' : 'Upgrade'}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-2 px-4 bg-gray-700/50 text-gray-500 rounded-lg cursor-not-allowed"
                  >
                    {isOwner ? 'N/A' : 'Contact Owner'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Invoices */}
      {isOwner && invoices.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-white mb-4">
            Invoice History
          </h3>
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Invoice
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 text-sm text-white">
                      {invoice.number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(invoice.created * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {invoice.currency} {invoice.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          invoice.status === 'paid'
                            ? 'bg-green-500/20 text-green-400'
                            : invoice.status === 'open'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {invoice.pdf_url && (
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          Download PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Cancel Subscription */}
      {isOwner && subscription.tier !== 'free' && subscription.isActive && (
        <section>
          <h3 className="text-lg font-semibold text-white mb-4">
            Danger Zone
          </h3>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <h4 className="text-red-400 font-medium mb-2">
              Cancel Subscription
            </h4>
            <p className="text-gray-400 text-sm mb-4">
              Your subscription will remain active until the end of your current
              billing period. After that, you'll be downgraded to the Free plan.
            </p>
            <button
              onClick={handleCancelSubscription}
              disabled={isCanceling}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isCanceling ? 'Canceling...' : 'Cancel Subscription'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
