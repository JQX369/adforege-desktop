"use client";

import { useEffect, useState } from "react";

interface PrintPipelineStatus {
  orderId: string;
  orderNumber: string;
  printStatus: string | null;
  coverFront: string | null;
  coverBack: string | null;
  coverSpread: string | null;
  interiorCount: number;
  insideBookPdf: string | null;
  updatedAt: string;
}

export default function PrintPipelinePage() {
  const [orders, setOrders] = useState<PrintPipelineStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrintPipeline = async () => {
      try {
        const response = await fetch("/api/print-pipeline");
        if (response.ok) {
          const data = await response.json();
          setOrders(data.orders || []);
        }
      } catch (error) {
        console.error("Failed to fetch print pipeline status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrintPipeline();
    const interval = setInterval(fetchPrintPipeline, 5000); // Refresh every 5s

    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string | null) => {
    if (!status) return <span className="badge badge-gray">pending</span>;

    const badges: Record<string, string> = {
      cover_generated: "badge-blue",
      interior_generated: "badge-purple",
      cmyk_converted: "badge-yellow",
      assembled: "badge-orange",
      completed: "badge-green",
      upload_failed: "badge-red"
    };

    return <span className={`badge ${badges[status] || "badge-gray"}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="container">
        <h1>Print Pipeline</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Print Pipeline Status</h1>
      <p className="subtitle">Real-time view of all print jobs (Gemini 2.5 Flash + OpenAI fallback)</p>

      {orders.length === 0 ? (
        <div className="empty-state">
          <p>No print jobs found.</p>
          <p>Trigger a print job by completing story packaging.</p>
        </div>
      ) : (
        <div className="print-pipeline-grid">
          {orders.map((order) => (
            <div key={order.orderId} className="print-card">
              <div className="print-card-header">
                <h3>Order {order.orderNumber}</h3>
                {getStatusBadge(order.printStatus)}
              </div>

              <div className="print-card-body">
                <div className="print-stat">
                  <span className="print-stat-label">Cover</span>
                  <span className="print-stat-value">
                    {order.coverFront && order.coverBack ? "✓ Generated" : "Pending"}
                  </span>
                </div>

                <div className="print-stat">
                  <span className="print-stat-label">Cover Spread</span>
                  <span className="print-stat-value">
                    {order.coverSpread ? "✓ Composed" : "Pending"}
                  </span>
                </div>

                <div className="print-stat">
                  <span className="print-stat-label">Interior Pages</span>
                  <span className="print-stat-value">{order.interiorCount || 0} pages</span>
                </div>

                <div className="print-stat">
                  <span className="print-stat-label">Inside Book PDF</span>
                  <span className="print-stat-value">
                    {order.insideBookPdf ? (
                      <a href={order.insideBookPdf} target="_blank" rel="noopener noreferrer">
                        📄 Download
                      </a>
                    ) : (
                      "Pending"
                    )}
                  </span>
                </div>

                <div className="print-stat">
                  <span className="print-stat-label">Last Updated</span>
                  <span className="print-stat-value">{new Date(order.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {(order.coverFront || order.coverBack || order.coverSpread) && (
                <div className="print-card-previews">
                  {order.coverFront && (
                    <div className="preview-thumb">
                      <img src={order.coverFront} alt="Front cover" />
                      <span>Front</span>
                    </div>
                  )}
                  {order.coverBack && (
                    <div className="preview-thumb">
                      <img src={order.coverBack} alt="Back cover" />
                      <span>Back</span>
                    </div>
                  )}
                  {order.coverSpread && (
                    <div className="preview-thumb preview-wide">
                      <img src={order.coverSpread} alt="Cover spread" />
                      <span>Spread (5457×2906)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .subtitle {
          color: #666;
          margin-bottom: 2rem;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: #f9f9f9;
          border-radius: 8px;
        }

        .print-pipeline-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .print-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .print-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e0e0e0;
          background: #f9f9f9;
        }

        .print-card-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge-gray {
          background: #e0e0e0;
          color: #666;
        }
        .badge-blue {
          background: #e3f2fd;
          color: #1976d2;
        }
        .badge-purple {
          background: #f3e5f5;
          color: #7b1fa2;
        }
        .badge-yellow {
          background: #fff9c4;
          color: #f57c00;
        }
        .badge-orange {
          background: #ffe0b2;
          color: #e65100;
        }
        .badge-green {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .badge-red {
          background: #ffebee;
          color: #c62828;
        }

        .print-card-body {
          padding: 1.5rem;
        }

        .print-stat {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .print-stat-label {
          color: #666;
          font-weight: 500;
        }

        .print-stat-value {
          color: #333;
          font-weight: 600;
        }

        .print-card-previews {
          display: flex;
          gap: 1rem;
          padding: 1rem 1.5rem;
          background: #f5f5f5;
          border-top: 1px solid #e0e0e0;
        }

        .preview-thumb {
          flex: 1;
          text-align: center;
        }

        .preview-thumb img {
          width: 100%;
          max-width: 120px;
          height: 120px;
          object-fit: cover;
          border-radius: 4px;
          border: 2px solid #e0e0e0;
          margin-bottom: 0.5rem;
        }

        .preview-thumb span {
          display: block;
          font-size: 0.75rem;
          color: #666;
          font-weight: 500;
        }

        .preview-wide {
          grid-column: 1 / -1;
        }

        .preview-wide img {
          max-width: 100%;
          width: auto;
          height: auto;
        }
      `}</style>
    </div>
  );
}

