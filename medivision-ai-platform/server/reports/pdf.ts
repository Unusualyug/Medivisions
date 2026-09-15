import PDFDocument from "pdfkit";

export function buildReportPdf(report: { id: number; originalFileName: string | null; studyId: number; status: string; modelVersion: string; findingsJson: string | null; analysisTimestamp: Date }) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    document.on("data", chunk => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.fontSize(22).fillColor("#0f172a").text("MediVision AI", { continued: true }).fontSize(10).fillColor("#0e7490").text("  Research report");
    document.moveDown(1.2).fontSize(18).fillColor("#0f172a").text(report.originalFileName || `Study ${report.studyId}`);
    document.moveDown(0.5).fontSize(10).fillColor("#475569").text(`Report ID: ${report.id}   Study ID: ${report.studyId}`);
    document.text(`Status: ${report.status}   Model: ${report.modelVersion}`);
    document.text(`Analysis time: ${new Date(report.analysisTimestamp).toISOString()}`);
    document.moveDown(1.2).fontSize(14).fillColor("#0f172a").text("Probability findings");
    let findings: Array<{ name: string; probability: number; positive?: boolean }> = [];
    try { const parsed = JSON.parse(report.findingsJson || "[]"); if (Array.isArray(parsed)) findings = parsed; } catch { findings = []; }
    if (!findings.length) document.moveDown(0.4).fontSize(11).fillColor("#64748b").text("No model findings are available yet.");
    findings.forEach(finding => document.moveDown(0.35).fontSize(11).fillColor("#0f172a").text(`${finding.name}: ${(Number(finding.probability) * 100).toFixed(1)}%${finding.positive ? " · positive signal" : ""}`));
    document.moveDown(1.4).fontSize(10).fillColor("#92400e").text("Research disclaimer: Model probabilities and explanation images are not diagnoses and must not be used for medical decision-making. This report is intended for research and educational use only.", { width: 500 });
    document.end();
  });
}
