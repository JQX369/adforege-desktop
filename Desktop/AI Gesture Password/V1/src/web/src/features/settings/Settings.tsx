import React, { useEffect, useState } from 'react';
import { PageContainer } from '@shared/components/PageContainer';
import { GlassCard } from '@shared/components/GlassCard';
import { api, type Settings as SettingsType } from '@lib/services/api';
import { useToast } from '@shared/components/Toast';
import { Save, Loader2 } from 'lucide-react';

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState<SettingsType>({
        corporation_name: '',
        accent_color: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await api.getSettings();
                setSettings(data);
            } catch (error) {
                console.error('Failed to fetch settings:', error);
                showToast('Failed to load settings', { type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [showToast]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateSettings(settings);
            showToast('Settings saved successfully', { type: 'success' });
        } catch (error) {
            console.error('Failed to save settings:', error);
            showToast('Failed to save settings', { type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="animate-spin text-neon-blue" size={32} />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <div className="max-w-2xl mx-auto space-y-8">
                <header>
                    <h2 className="text-3xl font-bold text-white mb-2">Settings</h2>
                    <p className="text-text-dim">Configure global application settings.</p>
                </header>

                <GlassCard className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-dim mb-1">
                                Corporation Name
                            </label>
                            <input
                                type="text"
                                value={settings.corporation_name}
                                onChange={(e) => setSettings({ ...settings, corporation_name: e.target.value })}
                                className="w-full px-4 py-2 bg-black/20 border border-glass-border rounded-lg text-white focus:outline-none focus:border-neon-blue transition-colors"
                                placeholder="Enter corporation name"
                            />
                            <p className="text-xs text-text-dim mt-1">
                                This name will appear on all generated PDF reports.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-dim mb-1">
                                Accent Colour
                            </label>
                            <div className="flex gap-4">
                                <input
                                    type="color"
                                    value={settings.accent_color}
                                    onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                                    className="h-10 w-20 bg-transparent border-none cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={settings.accent_color}
                                    onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                                    className="flex-1 px-4 py-2 bg-black/20 border border-glass-border rounded-lg text-white focus:outline-none focus:border-neon-blue transition-colors"
                                    placeholder="#000000"
                                />
                            </div>
                            <p className="text-xs text-text-dim mt-1">
                                This colour will be used for branding elements in PDF reports.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-neon-blue text-black font-bold hover:bg-neon-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </GlassCard>
            </div>
        </PageContainer>
    );
};
