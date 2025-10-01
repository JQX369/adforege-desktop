"use client";

import { useEffect, useState } from "react";

interface PrintConfig {
  id: string;
  name: string;
  isDefault: boolean;
  readingAge: string;
  fontSize: number;
  lineSpacing: number;
  fontFamily: string;
  textColor: string;
  textWidthPercent: number;
  borderPercent: number;
  maxWords: number | null;
  overlayPreferences: any;
  imageModelPreferences: any;
  iccProfilePath: string | null;
  bleedPercent: number;
  safeMarginMm: number;
  createdAt: string;
  updatedAt: string;
}

export default function PrintSettingsPage() {
  const [configs, setConfigs] = useState<PrintConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<PrintConfig | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch("/api/print-config");
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      }
    } catch (error) {
      console.error("Failed to fetch print configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (config: Partial<PrintConfig>) => {
    try {
      const response = await fetch("/api/print-config", {
        method: config.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        await fetchConfigs();
        setEditing(false);
        setSelectedConfig(null);
      }
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;

    try {
      const response = await fetch(`/api/print-config?id=${id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        await fetchConfigs();
        if (selectedConfig?.id === id) {
          setSelectedConfig(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete config:", error);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <h1>Print Settings</h1>
        <p>Loading configurations...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Print Settings Configuration</h1>
      <p className="subtitle">Configure text rendering, overlays, and print specifications by reading age</p>

      <div className="settings-grid">
        {/* Config List */}
        <div className="config-list">
          <div className="config-list-header">
            <h2>Reading Age Presets</h2>
            <button className="btn-primary" onClick={() => {
              setSelectedConfig({
                id: "",
                name: "New Config",
                isDefault: false,
                readingAge: "3-4",
                fontSize: 120,
                lineSpacing: 130,
                fontFamily: "Arial",
                textColor: "#000000",
                textWidthPercent: 80,
                borderPercent: 5.0,
                maxWords: 25,
                overlayPreferences: { positions: ["b", "t"] },
                imageModelPreferences: {
                  default: "imagen-3-fast-001",
                  cover_front: "imagen-3-fast-001",
                  cover_back: "imagen-3-fast-001",
                  interior_page: "imagen-3-fast-001",
                  vision_score: "gemini-2.5-flash-002",
                  overlay_position: "gemini-2.5-flash-002"
                },
                iccProfilePath: "CGATS21_CRPC1.icc",
                bleedPercent: 3.5,
                safeMarginMm: 6.0,
                createdAt: "",
                updatedAt: ""
              });
              setEditing(true);
            }}>
              + New Config
            </button>
          </div>

          {configs.map((config) => (
            <div
              key={config.id}
              className={`config-card ${selectedConfig?.id === config.id ? "active" : ""}`}
              onClick={() => {
                setSelectedConfig(config);
                setEditing(false);
              }}
            >
              <div className="config-card-header">
                <h3>{config.name}</h3>
                {config.isDefault && <span className="badge badge-primary">Default</span>}
              </div>
              <div className="config-card-body">
                <p><strong>Reading Age:</strong> {config.readingAge}</p>
                <p><strong>Font:</strong> {config.fontFamily} {config.fontSize}pt</p>
                <p><strong>Line Spacing:</strong> {config.lineSpacing}pt</p>
                <p><strong>Max Words:</strong> {config.maxWords || "N/A"}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Config Editor */}
        {selectedConfig && (
          <div className="config-editor">
            <div className="editor-header">
              <h2>{editing ? "Edit Configuration" : selectedConfig.name}</h2>
              <div className="editor-actions">
                {!editing && (
                  <>
                    <button className="btn-secondary" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                    {!selectedConfig.isDefault && (
                      <button className="btn-danger" onClick={() => handleDelete(selectedConfig.id)}>
                        Delete
                      </button>
                    )}
                  </>
                )}
                {editing && (
                  <>
                    <button className="btn-primary" onClick={() => handleSave(selectedConfig)}>
                      Save
                    </button>
                    <button className="btn-secondary" onClick={() => {
                      setEditing(false);
                      if (!selectedConfig.id) setSelectedConfig(null);
                    }}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="editor-form">
              <div className="form-section">
                <h3>Basic Settings</h3>

                <div className="form-group">
                  <label>Configuration Name</label>
                  <input
                    type="text"
                    value={selectedConfig.name}
                    disabled={!editing}
                    onChange={(e) => setSelectedConfig({ ...selectedConfig, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Reading Age</label>
                  <select
                    value={selectedConfig.readingAge}
                    disabled={!editing}
                    onChange={(e) => setSelectedConfig({ ...selectedConfig, readingAge: e.target.value })}
                  >
                    <option value="3-4">3-4 Years</option>
                    <option value="4-6">4-6 Years</option>
                    <option value="6-7">6-7 Years</option>
                    <option value="8">8+ Years</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedConfig.isDefault}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, isDefault: e.target.checked })}
                    />
                    Set as default for this reading age
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h3>Text Rendering</h3>

                <div className="form-group">
                  <label>Font Family</label>
                  <select
                    value={selectedConfig.fontFamily}
                    disabled={!editing}
                    onChange={(e) => setSelectedConfig({ ...selectedConfig, fontFamily: e.target.value })}
                  >
                    <option value="Arial">Arial</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Font Size (pt)</label>
                    <input
                      type="number"
                      value={selectedConfig.fontSize}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, fontSize: parseInt(e.target.value) })}
                      min={60}
                      max={200}
                    />
                  </div>

                  <div className="form-group">
                    <label>Line Spacing (pt)</label>
                    <input
                      type="number"
                      value={selectedConfig.lineSpacing}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, lineSpacing: parseInt(e.target.value) })}
                      min={60}
                      max={250}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Text Color</label>
                    <input
                      type="color"
                      value={selectedConfig.textColor}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, textColor: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Text Width (%)</label>
                    <input
                      type="number"
                      value={selectedConfig.textWidthPercent}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, textWidthPercent: parseInt(e.target.value) })}
                      min={50}
                      max={100}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Max Words per Page</label>
                  <input
                    type="number"
                    value={selectedConfig.maxWords || ""}
                    disabled={!editing}
                    onChange={(e) => setSelectedConfig({ ...selectedConfig, maxWords: parseInt(e.target.value) || null })}
                    min={10}
                    max={200}
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Print Specifications</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Border Margin (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedConfig.borderPercent}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, borderPercent: parseFloat(e.target.value) })}
                      min={0}
                      max={15}
                    />
                  </div>

                  <div className="form-group">
                    <label>Bleed (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedConfig.bleedPercent}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, bleedPercent: parseFloat(e.target.value) })}
                      min={3.5}
                      max={10}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Safe Margin (mm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedConfig.safeMarginMm}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, safeMarginMm: parseFloat(e.target.value) })}
                      min={3}
                      max={10}
                    />
                  </div>

                  <div className="form-group">
                    <label>ICC Profile</label>
                    <input
                      type="text"
                      value={selectedConfig.iccProfilePath || ""}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, iccProfilePath: e.target.value || null })}
                      placeholder="CGATS21_CRPC1.icc"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Overlay Preferences</h3>
                <p className="form-help">
                  Overlays are stored in <code>KCS Prop Files/overlays/{selectedConfig.readingAge}/</code>
                </p>
                <p className="form-help">
                  Available positions: <strong>b</strong> (bottom), <strong>t</strong> (top), <strong>tl</strong> (top-left), 
                  <strong>tr</strong> (top-right), <strong>bl</strong> (bottom-left), <strong>br</strong> (bottom-right)
                </p>
                <p className="form-help">
                  MAX overlays (for 450+ chars): <strong>topMAX</strong>, <strong>bottomMAX</strong>
                </p>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedConfig.overlayPreferences?.aiPlacementEnabled ?? true}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({
                        ...selectedConfig,
                        overlayPreferences: {
                          ...selectedConfig.overlayPreferences,
                          aiPlacementEnabled: e.target.checked
                        }
                      })}
                    />
                    Enable AI-powered overlay placement (Gemini 2.5 Flash)
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h3>Image Generation Models</h3>
                <p className="form-help">
                  Configure which AI models to use for image generation at each stage
                </p>

                {["cover_front", "cover_back", "interior_page", "vision_score", "overlay_position"].map((stage) => (
                  <div key={stage} className="form-group">
                    <label>{stage.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</label>
                    <select
                      value={selectedConfig.imageModelPreferences?.[stage] || "imagen-3-fast-001"}
                      disabled={!editing}
                      onChange={(e) => setSelectedConfig({
                        ...selectedConfig,
                        imageModelPreferences: {
                          ...selectedConfig.imageModelPreferences,
                          [stage]: e.target.value
                        }
                      })}
                    >
                      <optgroup label="Gemini Imagen 3">
                        <option value="imagen-3-fast-001">Imagen 3 Fast</option>
                        <option value="imagen-3-pro-001">Imagen 3 Pro</option>
                      </optgroup>
                      <optgroup label="Gemini 2.5 Flash">
                        <option value="gemini-2.5-flash-002">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-flash-nano-banana">Gemini 2.5 Flash Nano Banana</option>
                      </optgroup>
                      <optgroup label="OpenAI">
                        <option value="dall-e-3">DALL-E 3</option>
                        <option value="gpt-image-1">GPT Image 1</option>
                        <option value="gpt-4o">GPT-4o Vision</option>
                      </optgroup>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }

        .subtitle {
          color: #666;
          margin-bottom: 2rem;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 2rem;
        }

        .config-list {
          background: #f9f9f9;
          padding: 1.5rem;
          border-radius: 8px;
          height: fit-content;
        }

        .config-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .config-list-header h2 {
          margin: 0;
          font-size: 1.2rem;
        }

        .config-card {
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .config-card:hover {
          border-color: #2196f3;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .config-card.active {
          border-color: #2196f3;
          background: #e3f2fd;
        }

        .config-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .config-card-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .config-card-body p {
          margin: 0.25rem 0;
          font-size: 0.9rem;
          color: #666;
        }

        .config-editor {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 2rem;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e0e0e0;
        }

        .editor-header h2 {
          margin: 0;
        }

        .editor-actions {
          display: flex;
          gap: 0.5rem;
        }

        .editor-form {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .form-section {
          padding: 1.5rem;
          background: #f9f9f9;
          border-radius: 6px;
        }

        .form-section h3 {
          margin: 0 0 1.5rem 0;
          font-size: 1.1rem;
          color: #333;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #555;
        }

        .form-group input[type="text"],
        .form-group input[type="number"],
        .form-group select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }

        .form-group input[type="color"] {
          width: 100px;
          height: 40px;
          padding: 0.25rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .form-group input:disabled,
        .form-group select:disabled {
          background: #f0f0f0;
          cursor: not-allowed;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-help {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 0.75rem;
        }

        .form-help code {
          background: #e0e0e0;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
          font-family: monospace;
        }

        .btn-primary, .btn-secondary, .btn-danger {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #2196f3;
          color: white;
        }

        .btn-primary:hover {
          background: #1976d2;
        }

        .btn-secondary {
          background: #757575;
          color: white;
        }

        .btn-secondary:hover {
          background: #616161;
        }

        .btn-danger {
          background: #f44336;
          color: white;
        }

        .btn-danger:hover {
          background: #d32f2f;
        }

        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge-primary {
          background: #2196f3;
          color: white;
        }
      `}</style>
    </div>
  );
}

