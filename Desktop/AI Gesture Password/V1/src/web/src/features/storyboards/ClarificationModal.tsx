import React, { useState } from 'react';
import { X, Check, HelpCircle, MessageSquare, Upload, Image, Package, Palette, User, MapPin, FileImage, Loader2 } from 'lucide-react';
import type { ClarificationQuestion, ClarificationResponse, AssetRequest, UploadedAsset } from '@lib/services/api';
import { api } from '@lib/services/api';
import { GlassCard } from '@shared/components/GlassCard';

// Icon mapping for asset types
const assetTypeIcons: Record<string, React.ReactNode> = {
    logo: <Image size={20} />,
    product: <Package size={20} />,
    brand_guide: <Palette size={20} />,
    character_ref: <User size={20} />,
    location_ref: <MapPin size={20} />,
    other: <FileImage size={20} />
};

const assetTypeLabels: Record<string, string> = {
    logo: 'Logo',
    product: 'Product Image',
    brand_guide: 'Brand Guide',
    character_ref: 'Character Reference',
    location_ref: 'Location Reference',
    other: 'Other Asset'
};

interface ClarificationModalProps {
    questions: ClarificationQuestion[];
    assetRequests?: AssetRequest[];
    analysisId: string;
    onConfirm: (response: ClarificationResponse) => void;
    onCancel: () => void;
    isSubmitting: boolean;
}

export const ClarificationModal: React.FC<ClarificationModalProps> = ({ 
    questions, 
    assetRequests = [],
    analysisId, 
    onConfirm, 
    onCancel,
    isSubmitting 
}) => {
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
    const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
    const [uploadingAssetId, setUploadingAssetId] = useState<string | null>(null);
    const [assetFiles, setAssetFiles] = useState<Record<string, File>>({});

    const handleOptionSelect = (questionId: string, optionId: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const handleCustomAnswerChange = (questionId: string, text: string) => {
        setCustomAnswers(prev => ({ ...prev, [questionId]: text }));
    };

    const handleAssetUpload = async (assetRequestId: string, file: File) => {
        setUploadingAssetId(assetRequestId);
        setAssetFiles(prev => ({ ...prev, [assetRequestId]: file }));
        
        try {
            const uploaded = await api.uploadStoryboardAsset(file, assetRequestId);
            setUploadedAssets(prev => {
                // Remove any existing upload for this asset request
                const filtered = prev.filter(a => a.asset_request_id !== assetRequestId);
                return [...filtered, uploaded];
            });
        } catch (error) {
            console.error('Failed to upload asset:', error);
            alert('Failed to upload asset. Please try again.');
            setAssetFiles(prev => {
                const next = { ...prev };
                delete next[assetRequestId];
                return next;
            });
        } finally {
            setUploadingAssetId(null);
        }
    };

    const handleRemoveAsset = (assetRequestId: string) => {
        setUploadedAssets(prev => prev.filter(a => a.asset_request_id !== assetRequestId));
        setAssetFiles(prev => {
            const next = { ...prev };
            delete next[assetRequestId];
            return next;
        });
    };

    const handleSubmit = () => {
        // Construct simple Q->A map
        const finalAnswers: Record<string, string> = {};
        
        questions.forEach(q => {
            const selectedOptId = answers[q.id];
            const customText = customAnswers[q.id];
            
            if (customText && customText.trim()) {
                finalAnswers[q.id] = customText;
            } else if (selectedOptId) {
                const opt = q.options.find(o => o.id === selectedOptId);
                if (opt) finalAnswers[q.id] = opt.text;
            }
        });

        // Validate all questions answered
        if (Object.keys(finalAnswers).length < questions.length) {
            alert("Please answer all questions to proceed.");
            return;
        }

        // Check required assets
        const requiredAssets = assetRequests.filter(ar => ar.required);
        const uploadedIds = new Set(uploadedAssets.map(ua => ua.asset_request_id));
        const missingRequired = requiredAssets.filter(ar => !uploadedIds.has(ar.id));
        
        if (missingRequired.length > 0) {
            alert(`Please upload required assets: ${missingRequired.map(ar => ar.name).join(', ')}`);
            return;
        }

        onConfirm({
            analysis_id: analysisId,
            answers: finalAnswers,
            uploaded_assets: uploadedAssets
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <GlassCard className="p-8 border-neon-purple/30 shadow-2xl shadow-neon-purple/10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <HelpCircle className="text-neon-purple" />
                                Refine Your Storyboard
                            </h2>
                            <p className="text-text-dim mt-2">
                                The AI has a few questions to better visualize your script.
                            </p>
                        </div>
                        <button onClick={onCancel} className="text-text-dim hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Questions Section */}
                    <div className="space-y-8">
                        {questions.map((q, idx) => (
                            <div key={q.id} className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neon-blue/20 text-neon-blue flex items-center justify-center text-sm font-bold">
                                        {idx + 1}
                                    </span>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium text-white">{q.question}</h3>
                                        <p className="text-sm text-text-dim/80 italic mt-1">{q.context}</p>
                                    </div>
                                </div>

                                <div className="pl-9 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {q.options.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleOptionSelect(q.id, opt.id)}
                                            className={`p-4 rounded-xl border text-left transition-all ${
                                                answers[q.id] === opt.id && !customAnswers[q.id]
                                                    ? 'bg-neon-purple/20 border-neon-purple text-white ring-1 ring-neon-purple/30'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-text-dim'
                                            }`}
                                        >
                                            <span className="font-bold text-lg block mb-1">{opt.id}</span>
                                            <span className="text-sm">{opt.text}</span>
                                        </button>
                                    ))}
                                </div>
                                
                                <div className="pl-9">
                                    <div className="relative">
                                        <MessageSquare size={16} className="absolute left-3 top-3 text-text-dim" />
                                        <input
                                            type="text"
                                            placeholder="Or type a custom answer..."
                                            value={customAnswers[q.id] || ''}
                                            onChange={(e) => {
                                                handleCustomAnswerChange(q.id, e.target.value);
                                                // Clear option selection if typing
                                                if (e.target.value) {
                                                    setAnswers(prev => {
                                                        const next = { ...prev };
                                                        delete next[q.id];
                                                        return next;
                                                    });
                                                }
                                            }}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Asset Upload Section */}
                    {assetRequests.length > 0 && (
                        <div className="mt-10 pt-8 border-t border-white/10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-lg bg-neon-pink/20">
                                    <Upload className="text-neon-pink" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Brand Assets Needed</h3>
                                    <p className="text-sm text-text-dim">Upload these assets to make your storyboard accurate</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {assetRequests.map((asset) => {
                                    const isUploaded = uploadedAssets.some(ua => ua.asset_request_id === asset.id);
                                    const isUploading = uploadingAssetId === asset.id;
                                    const uploadedFile = assetFiles[asset.id];

                                    return (
                                        <div
                                            key={asset.id}
                                            className={`p-4 rounded-xl border transition-all ${
                                                isUploaded
                                                    ? 'bg-neon-green/10 border-neon-green/30'
                                                    : 'bg-white/5 border-white/10'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg ${
                                                    isUploaded ? 'bg-neon-green/20 text-neon-green' : 'bg-white/10 text-text-dim'
                                                }`}>
                                                    {assetTypeIcons[asset.asset_type] || assetTypeIcons.other}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium text-white truncate">{asset.name}</h4>
                                                        {asset.required && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 uppercase">
                                                                Required
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-text-dim mt-1 line-clamp-2">{asset.description}</p>
                                                    <span className="text-[10px] text-text-dim/60 uppercase tracking-wider">
                                                        {assetTypeLabels[asset.asset_type] || 'Asset'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3">
                                                {isUploaded && uploadedFile ? (
                                                    <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Check size={14} className="text-neon-green flex-shrink-0" />
                                                            <span className="text-sm text-white truncate">{uploadedFile.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveAsset(asset.id)}
                                                            className="text-text-dim hover:text-red-400 flex-shrink-0 ml-2"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-dashed cursor-pointer transition-all ${
                                                        isUploading
                                                            ? 'border-neon-blue/50 bg-neon-blue/10'
                                                            : 'border-white/20 hover:border-neon-pink/50 hover:bg-white/5'
                                                    }`}>
                                                        {isUploading ? (
                                                            <>
                                                                <Loader2 size={16} className="animate-spin text-neon-blue" />
                                                                <span className="text-sm text-neon-blue">Uploading...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Upload size={16} className="text-text-dim" />
                                                                <span className="text-sm text-text-dim">Choose file</span>
                                                            </>
                                                        )}
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/*,.pdf"
                                                            disabled={isUploading}
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    handleAssetUpload(asset.id, file);
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-white/10">
                        <button
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="px-6 py-3 rounded-xl border border-white/10 text-text-dim hover:text-white hover:bg-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-8 py-3 bg-neon-purple text-white rounded-xl font-semibold hover:bg-neon-purple/90 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSubmitting ? 'Generating...' : 'Generate Storyboard'}
                            {!isSubmitting && <Check size={18} />}
                        </button>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};

