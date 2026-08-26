/**
 * Bulk Transaction Upload Component
 * 
 * Allows admin to upload multiple transactions via CSV file.
 * Validates data and provides detailed feedback on success/errors.
 * 
 * CSV Format:
 * member_phone,type,amount,memo,posted_date
 * +256700000001,deposit,50000,Weekly savings,2024-01-15
 */

"use client";

import { useState } from "react";
import { Upload, AlertCircle, CheckCircle, XCircle, Download } from "lucide-react";
import { bulkUploadTransactions } from "@/app/actions";

interface UploadResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

export function BulkTransactionUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const text = await file.text();
      const formData = new FormData();
      formData.set("csv_data", text);

      const response = await bulkUploadTransactions(formData);

      if (response.success && response.data) {
        setResult(response.data as UploadResult);
      } else {
        setResult({
          success: false,
          processed: 0,
          failed: 0,
          errors: [{ row: 0, error: response.error || "Upload failed" }]
        });
      }
    } catch (error) {
      setResult({
        success: false,
        processed: 0,
        failed: 0,
        errors: [{ row: 0, error: error instanceof Error ? error.message : "Unknown error" }]
      });
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const template = `member_phone,type,amount,memo,posted_date
+256700000001,deposit,50000,Weekly savings,2024-01-15
+256700000002,withdrawal,30000,Emergency withdrawal,2024-01-15
+256700000003,deposit,100000,Monthly contribution,2024-01-15`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transaction_upload_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bulk-upload-container">
      <div className="bulk-upload-header">
        <h3>Bulk Transaction Upload</h3>
        <button 
          className="btn-download btn-template"
          onClick={downloadTemplate}
          type="button"
        >
          <Download size={14} />
          Download Template
        </button>
      </div>

      <div className="bulk-upload-instructions">
        <AlertCircle size={16} />
        <div>
          <strong>CSV Format Required:</strong>
          <ul>
            <li>Columns: member_phone, type, amount, memo, posted_date</li>
            <li>Types: deposit, withdrawal, loan_payment, fee, adjustment</li>
            <li>Date format: YYYY-MM-DD</li>
            <li>Phone must match existing member</li>
          </ul>
        </div>
      </div>

      <div className="bulk-upload-form">
        <label className="file-upload-label">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setResult(null);
            }}
            disabled={uploading}
          />
          <div className="file-upload-display">
            <Upload size={20} />
            {file ? (
              <span>{file.name}</span>
            ) : (
              <span>Click to select CSV file</span>
            )}
          </div>
        </label>

        <button
          className="btn-primary"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? "Uploading..." : "Upload Transactions"}
        </button>
      </div>

      {result && (
        <div className={`bulk-upload-result ${result.success ? "success" : "error"}`}>
          <div className="result-summary">
            {result.success ? (
              <CheckCircle size={20} className="icon-success" />
            ) : (
              <XCircle size={20} className="icon-error" />
            )}
            <div>
              <strong>
                {result.success
                  ? `Successfully processed ${result.processed} transaction(s)`
                  : "Upload completed with errors"}
              </strong>
              {result.failed > 0 && (
                <p>{result.failed} transaction(s) failed</p>
              )}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="result-errors">
              <strong>Errors:</strong>
              <ul>
                {result.errors.map((err, idx) => (
                  <li key={idx}>
                    Row {err.row}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
