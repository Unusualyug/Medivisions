export type MlPrediction = {
  findings?: Array<{ name: string; probability: number; decision?: string }>;
  probabilities?: Record<string, number>;
  modelVersion?: string;
  threshold?: number;
  [key: string]: unknown;
};

export function getMlServiceUrl() {
  return (process.env.ML_SERVICE_URL || "http://127.0.0.1:8001").replace(
    /\/$/,
    ""
  );
}

export async function mlHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${getMlServiceUrl()}/health`, {
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    return { reachable: response.ok, status: body };
  } catch (error) {
    return {
      reachable: false,
      status: {
        error:
          error instanceof Error ? error.message : "ML service unavailable",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function predictWithDenseNet(input: {
  imageUrl: string;
  studyId: string;
  threshold?: number;
}): Promise<MlPrediction> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${getMlServiceUrl()}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        body?.detail?.message ||
          body?.detail ||
          `ML service returned ${response.status}`
      );
    return body as MlPrediction;
  } finally {
    clearTimeout(timer);
  }
}
export type GradcamResult = {
  studyId?: string;
  finding: string;
  paths: {
    original: string;
    processed: string;
    heatmap: string;
    overlay: string;
  };
  images: {
    original: string;
    processed: string;
    heatmap: string;
    overlay: string;
  };
  disclaimer?: string;
};

export async function generateGradcam(input: {
  imageUrl: string;
  studyId: string;
  finding: string;
}): Promise<GradcamResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const imageResponse = await fetch(input.imageUrl, {
      signal: controller.signal,
    });
    if (!imageResponse.ok)
      throw new Error(`Failed to fetch source image: ${imageResponse.status}`);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const form = new FormData();
    form.append("image", new Blob([imageBuffer]), "xray.png");
    if (input.studyId) form.append("studyId", input.studyId);
    form.append("finding", input.finding);

    const response = await fetch(`${getMlServiceUrl()}/gradcam`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        body?.detail?.message ||
          body?.detail ||
          `ML service returned ${response.status}`
      );
    return body as GradcamResult;
  } finally {
    clearTimeout(timer);
  }
}
