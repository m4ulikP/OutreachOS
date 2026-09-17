"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { LeadStageBadge } from "@/components/ui/badge";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Loader2,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadStage } from "@prisma/client";
import { CsvImportSummary, DuplicateDetail } from "@/lib/services/import-service";
import { RowValidationError } from "@/lib/csv/validator";

type ModalState = "UPLOAD" | "PREVIEW" | "IMPORTING" | "SUMMARY";

export interface CsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CsvImportModal({
  open,
  onOpenChange,
  onSuccess,
}: CsvImportModalProps) {
  const [modalState, setModalState] = React.useState<ModalState>("UPLOAD");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Preview & Summary Data
  const [previewSummary, setPreviewSummary] = React.useState<CsvImportSummary | null>(null);
  const [finalSummary, setFinalSummary] = React.useState<CsvImportSummary | null>(null);

  // Accordion toggles for summary errors / duplicates
  const [showErrors, setShowErrors] = React.useState(true);
  const [showDuplicates, setShowDuplicates] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset modal on open change
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        resetState();
      }, 200);
    }
  }, [open]);

  const resetState = () => {
    setModalState("UPLOAD");
    setSelectedFile(null);
    setIsDragging(false);
    setIsProcessing(false);
    setErrorMessage(null);
    setPreviewSummary(null);
    setFinalSummary(null);
    setShowErrors(true);
    setShowDuplicates(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Download safe template CSV
  const handleDownloadTemplate = () => {
    const headers =
      "Full Name,First Name,Last Name,Email,Job Title,Company,Website,LinkedIn URL,Phone,Industry,Location,Stage,Notes";
    const sampleRows = [
      'Jane Doe,Jane,Doe,jane.doe@example.com,VP of Engineering,Acme Corp,https://acme.example.com,https://linkedin.com/in/janedoe,+1-555-0101,SaaS,San Francisco CA,NEW,"Met at TechSummit 2026"',
      'Marcus Vance,Marcus,Vance,marcus.vance@example.org,Head of Sales,Nexus Dynamics,https://nexus.example.org,https://linkedin.com/in/marcusvance,+1-555-0102,FinTech,New York NY,CONTACTED,"Referred by partner agency"',
      'Sarah Chen,Sarah,Chen,sarah.chen@example.io,Founder & CEO,Apex Systems,https://apex.example.io,https://linkedin.com/in/sarahchen,+1-555-0103,AI / Cloud,Austin TX,NEW,"Target account for Q3 enterprise expansion"',
    ];
    const csvContent = [headers, ...sampleRows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "outreachos-lead-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Process File for Preview
  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);

    // Client-side safety checks
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Please select a valid .csv file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(
        `File size exceeds 5 MB limit (selected file is ${(
          file.size /
          (1024 * 1024)
        ).toFixed(2)} MB).`
      );
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/leads/import?preview=true", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to parse CSV preview.");
      }

      setPreviewSummary(data);
      setModalState("PREVIEW");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Commit Import
  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setModalState("IMPORTING");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok && !data.totalProcessed) {
        throw new Error(data.message || data.error || "CSV Import failed.");
      }

      setFinalSummary(data);
      setModalState("SUMMARY");
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      setErrorMessage(msg);
      setModalState("PREVIEW");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        modalState === "UPLOAD"
          ? "Import Leads from CSV"
          : modalState === "PREVIEW"
          ? "Preview & Verify CSV Data"
          : modalState === "IMPORTING"
          ? "Importing Leads..."
          : "Import Summary"
      }
      description={
        modalState === "UPLOAD"
          ? "Upload your prospect list adhering to standard RFC 4180 format. Up to 2,000 rows per batch."
          : modalState === "PREVIEW"
          ? "Review detected columns and sample rows. Pre-import validation and deduplication checks completed."
          : modalState === "IMPORTING"
          ? "Persisting records and resolving company associations in bounded transactions of 50 leads."
          : "Import execution completed. Review created leads, skipped duplicates, and rejected records."
      }
      className="max-w-3xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-4 pt-1">
        {/* Error Banner */}
        {errorMessage && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold">Import Error:</span>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* 1. UPLOAD STATE */}
        {modalState === "UPLOAD" && (
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border-hover hover:bg-surface"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="csv-file-upload-input"
              />

              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                {isProcessing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <UploadCloud className="h-6 w-6" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {isProcessing
                    ? "Validating CSV structure..."
                    : "Drag & drop your CSV file here, or browse"}
                </p>
                <p className="text-xs text-foreground-muted">
                  RFC 4180 compliant CSV • UTF-8 • Up to 5 MB • Maximum 2,000 rows
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5 text-xs"
                disabled={isProcessing}
              >
                <FileText className="h-3.5 w-3.5" />
                Select CSV File
              </Button>
            </div>

            {/* Template Download & Instructions */}
            <div className="rounded-xl border border-border bg-surface p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground">Need a standardized template?</span>
                <p className="text-foreground-muted">
                  Download our pre-formatted CSV template with sample prospect columns.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-1.5 shrink-0 text-xs"
              >
                <Download className="h-3.5 w-3.5 text-foreground-muted" />
                Download Template CSV
              </Button>
            </div>

            <div className="text-[11px] text-foreground-muted space-y-1">
              <p className="font-semibold text-foreground">Validation & Deduplication Rules:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Every prospect row must include at least one identifier: Name, Email, or LinkedIn URL.</li>
                <li>Duplicates matching an existing lead or another row in the same CSV are automatically skipped.</li>
                <li>Companies are automatically resolved and created safely using multi-tenant unique indexes.</li>
              </ul>
            </div>
          </div>
        )}

        {/* 2. PREVIEW STATE */}
        {modalState === "PREVIEW" && previewSummary && (
          <div className="space-y-4">
            {/* Header & Stats Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-[10px] uppercase font-semibold text-foreground-muted">Total Rows</div>
                <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                  {previewSummary.totalProcessed}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-[10px] uppercase font-semibold text-success">Ready to Import</div>
                <div className="text-lg font-bold font-mono text-success mt-0.5">
                  {previewSummary.readyToImport ?? 0}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-[10px] uppercase font-semibold text-warning">Duplicates</div>
                <div className="text-lg font-bold font-mono text-warning mt-0.5">
                  {previewSummary.duplicatesSkipped}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-[10px] uppercase font-semibold text-destructive">Invalid Rows</div>
                <div className="text-lg font-bold font-mono text-destructive mt-0.5">
                  {previewSummary.invalidRows}
                </div>
              </div>
            </div>

            {/* Detected Columns */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Detected & Mapped Columns ({previewSummary.canonicalHeaders.length})</span>
                <span className="text-foreground-muted font-normal">
                  File: {selectedFile?.name}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {previewSummary.canonicalHeaders.map((col, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-surface border border-border text-foreground"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Preview Table of First 5 Rows */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground">
                Sample Valid Records (First 5 Rows)
              </div>
              <div className="rounded-lg border border-border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">Row</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Job Title</TableHead>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewSummary.sampleLeads && previewSummary.sampleLeads.length > 0 ? (
                      previewSummary.sampleLeads.map((sample, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs text-foreground-muted">
                            {sample.rowNumber}
                          </TableCell>
                          <TableCell className="font-medium text-xs text-foreground">
                            {sample.fullName || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-foreground-muted">
                            {sample.email || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-foreground-muted">
                            {sample.jobTitle || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-foreground-muted">
                            {sample.companyName || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <LeadStageBadge stage={sample.stage || LeadStage.NEW} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-xs text-foreground-muted">
                          No valid new prospect rows ready to import.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Validation / Deduplication Warnings Accordion */}
            {previewSummary.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-destructive">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Validation Errors ({previewSummary.errors.length} issue{previewSummary.errors.length === 1 ? "" : "s"})
                  </span>
                  <span className="text-[11px] font-normal">Invalid rows will be skipped</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                  {previewSummary.errors.slice(0, 10).map((err, idx) => (
                    <div key={idx} className="text-foreground-muted text-[11px]">
                      <span className="font-mono font-semibold text-destructive">Row {err.rowNumber}:</span>{" "}
                      {err.field ? <span className="font-medium text-foreground">{err.field} — </span> : null}
                      {err.message}
                    </div>
                  ))}
                  {previewSummary.errors.length > 10 && (
                    <div className="text-[10px] text-foreground-muted italic">
                      + {previewSummary.errors.length - 10} more validation errors...
                    </div>
                  )}
                </div>
              </div>
            )}

            {previewSummary.duplicateDetails.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-warning">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Duplicates Detected ({previewSummary.duplicateDetails.length})
                  </span>
                  <span className="text-[11px] font-normal">Will be skipped to preserve uniqueness</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                  {previewSummary.duplicateDetails.slice(0, 5).map((dup, idx) => (
                    <div key={idx} className="text-foreground-muted text-[11px]">
                      <span className="font-mono font-semibold text-foreground">Row {dup.rowNumber}:</span>{" "}
                      {dup.reason}
                    </div>
                  ))}
                  {previewSummary.duplicateDetails.length > 5 && (
                    <div className="text-[10px] text-foreground-muted italic">
                      + {previewSummary.duplicateDetails.length - 5} more duplicate records...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetState}
                className="text-xs"
              >
                Choose Another File
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmImport}
                disabled={(previewSummary.readyToImport ?? 0) === 0}
                className="text-xs gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm Import ({previewSummary.readyToImport ?? 0} Leads)
              </Button>
            </div>
          </div>
        )}

        {/* 3. IMPORTING STATE */}
        {modalState === "IMPORTING" && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-spin">
              <Loader2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Importing Your Prospects</h3>
              <p className="text-xs text-foreground-muted max-w-sm">
                Processing in bounded batches of 50. Multi-tenant company relationships and deduplication indexes are being updated...
              </p>
            </div>
            <div className="w-full max-w-xs bg-surface-elevated rounded-full h-1.5 overflow-hidden">
              <div className="bg-primary h-full w-2/3 animate-pulse" />
            </div>
          </div>
        )}

        {/* 4. SUMMARY STATE */}
        {modalState === "SUMMARY" && finalSummary && (
          <div className="space-y-4">
            <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-success shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-foreground">Import Completed</h4>
                <p className="text-xs text-foreground-muted">
                  Processed {finalSummary.totalProcessed} records across {finalSummary.batchCount} batch transaction{finalSummary.batchCount === 1 ? "" : "s"}.
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-[10px] uppercase font-semibold text-success">Created</div>
                <div className="text-lg font-bold font-mono text-success mt-0.5">
                  {finalSummary.created}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-[10px] uppercase font-semibold text-warning">Duplicates Skipped</div>
                <div className="text-lg font-bold font-mono text-warning mt-0.5">
                  {finalSummary.duplicatesSkipped}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-[10px] uppercase font-semibold text-destructive">Invalid Rejected</div>
                <div className="text-lg font-bold font-mono text-destructive mt-0.5">
                  {finalSummary.invalidRows}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-[10px] uppercase font-semibold text-foreground-muted">Total Processed</div>
                <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                  {finalSummary.totalProcessed}
                </div>
              </div>
            </div>

            {/* Expandable Errors */}
            {finalSummary.errors.length > 0 && (
              <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowErrors(!showErrors)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-destructive"
                >
                  <span className="flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    Row-Level Errors ({finalSummary.errors.length})
                  </span>
                  {showErrors ? (
                    <ChevronUp className="h-3.5 w-3.5 text-foreground-muted" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-foreground-muted" />
                  )}
                </button>

                {showErrors && (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1">
                    {finalSummary.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="text-xs rounded border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 flex items-start gap-2"
                      >
                        <span className="font-mono font-semibold text-destructive shrink-0">
                          Row {err.rowNumber}
                        </span>
                        <div className="text-foreground-muted">
                          {err.field && (
                            <span className="font-semibold text-foreground">
                              {err.field}:{" "}
                            </span>
                          )}
                          {err.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Expandable Duplicates */}
            {finalSummary.duplicateDetails.length > 0 && (
              <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDuplicates(!showDuplicates)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-warning"
                >
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Duplicate Leads Skipped ({finalSummary.duplicateDetails.length})
                  </span>
                  {showDuplicates ? (
                    <ChevronUp className="h-3.5 w-3.5 text-foreground-muted" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-foreground-muted" />
                  )}
                </button>

                {showDuplicates && (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1">
                    {finalSummary.duplicateDetails.map((dup, idx) => (
                      <div
                        key={idx}
                        className="text-xs rounded border border-warning/20 bg-warning/5 px-2.5 py-1.5 flex items-start gap-2"
                      >
                        <span className="font-mono font-semibold text-warning shrink-0">
                          Row {dup.rowNumber}
                        </span>
                        <div className="text-foreground-muted">{dup.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Summary Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetState}
                className="text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Import Another File
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
