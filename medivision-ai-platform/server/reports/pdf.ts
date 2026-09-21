import PDFDocument from "pdfkit";

type ReportForPdf = {
  id: number;
  originalFileName: string | null;
  studyId: number;
  status: string;
  modelVersion: string;
  findingsJson: string | null;
  analysisTimestamp: Date;
  originalImageUrl?: string | null;
  processedImageUrl?: string | null;
  gradcamHeatmapUrl?: string | null;
  gradcamOverlayUrl?: string | null;
};

async function fetchImageBuffer(url?: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export async function buildReportPdf(report: ReportForPdf) {
  const [originalImage, processedImage, heatmapImage, overlayImage] =
    await Promise.all([
      fetchImageBuffer(report.originalImageUrl),
      fetchImageBuffer(report.processedImageUrl),
      fetchImageBuffer(report.gradcamHeatmapUrl),
      fetchImageBuffer(report.gradcamOverlayUrl),
    ]);

  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    document.on("data", chunk => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document
      .fontSize(22)
      .fillColor("#0f172a")
      .text("MediVision AI", { continued: true })
      .fontSize(10)
      .fillColor("#0e7490")
      .text("  Research report");
    document
      .moveDown(1.2)
      .fontSize(18)
      .fillColor("#0f172a")
      .text(report.originalFileName || `Study ${report.studyId}`);
    document
      .moveDown(0.5)
      .fontSize(10)
      .fillColor("#475569")
      .text(`Report ID: ${report.id}   Study ID: ${report.studyId}`);
    document.text(`Status: ${report.status}   Model: ${report.modelVersion}`);
    document.text(
      `Analysis time: ${new Date(report.analysisTimestamp).toISOString()}`
    );

    document
      .moveDown(1.2)
      .fontSize(14)
      .fillColor("#0f172a")
      .text("Probability findings");
    let findings: Array<{
      name: string;
      probability: number;
      positive?: boolean;
    }> = [];
    try {
      const parsed = JSON.parse(report.findingsJson || "[]");
      if (Array.isArray(parsed)) findings = parsed;
    } catch {
      findings = [];
    }
    if (!findings.length)
      document
        .moveDown(0.4)
        .fontSize(11)
        .fillColor("#64748b")
        .text("No model findings are available yet.");
    findings.forEach(finding => {
      const isPositive = Boolean(finding.positive);
      document
        .moveDown(0.35)
        .fontSize(11)
        .fillColor(isPositive ? "#be123c" : "#0f172a")
        .text(
          `${finding.name}: ${(Number(finding.probability) * 100).toFixed(1)}%  ·  ${
            isPositive ? "Positive signal" : "Negative signal"
          }`
        );
    });

    // --- Visual review section ---
    const images: Array<{ label: string; buffer: Buffer | null }> = [
      { label: "Original X-ray", buffer: originalImage },
      { label: "Processed image", buffer: processedImage },
      { label: "Grad-CAM heatmap", buffer: heatmapImage },
      { label: "Grad-CAM overlay", buffer: overlayImage },
    ];
    const availableImages = images.filter(image => image.buffer);

    if (availableImages.length) {
      document.addPage();
      document
        .fontSize(14)
        .fillColor("#0f172a")
        .text("Visual review", { underline: false });
      document.moveDown(0.6);

      for (const image of availableImages) {
        if (!image.buffer) continue;
        document.fontSize(11).fillColor("#0f172a").text(image.label);
        document.moveDown(0.2);
        try {
          document.image(image.buffer, {
            fit: [480, 320],
            align: "center",
          });
        } catch {
          document
            .fontSize(10)
            .fillColor("#94a3b8")
            .text("(Image could not be rendered)");
        }
        document.moveDown(1);
        if (
          document.y >
            document.page.height - document.page.margins.bottom - 150 &&
          image !== availableImages[availableImages.length - 1]
        ) {
          document.addPage();
        }
      }
    }

    document
      .moveDown(1.4)
      .fontSize(10)
      .fillColor("#92400e")
      .text(
        "Research disclaimer: Model probabilities and explanation images are not diagnoses and must not be used for medical decision-making. This report is intended for research and educational use only.",
        { width: 500 }
      );
    document.end();
  });
}
