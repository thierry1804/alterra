export const FACE_MATCH_THRESHOLD = 0.6;

export type FaceMatchResult = "OK" | "DOUBT" | "KO";

let modelsLoaded = false;
let modelsAvailable = false;

export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error("DESCRIPTOR_LENGTH_MISMATCH");
  }
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    const delta = a[index]! - b[index]!;
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

export function scoreFromDistance(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}

export function resultFromDistance(distance: number): FaceMatchResult {
  if (distance <= FACE_MATCH_THRESHOLD) return "OK";
  if (distance <= FACE_MATCH_THRESHOLD + 0.15) return "DOUBT";
  return "KO";
}

export function matchDescriptors(
  probe: Float32Array,
  reference: Float32Array,
): { result: FaceMatchResult; score: number; distance: number } {
  const distance = euclideanDistance(probe, reference);
  return {
    distance,
    score: scoreFromDistance(distance),
    result: resultFromDistance(distance),
  };
}

export async function ensureFaceModelsLoaded(): Promise<boolean> {
  if (modelsLoaded) return modelsAvailable;

  modelsLoaded = true;
  try {
    const faceapi = await import("@vladmandic/face-api");
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]);
    modelsAvailable = true;
  } catch {
    modelsAvailable = false;
  }

  return modelsAvailable;
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function extractDescriptorFromBlob(blob: Blob): Promise<Float32Array | null> {
  const ready = await ensureFaceModelsLoaded();
  if (!ready) return null;

  const faceapi = await import("@vladmandic/face-api");
  const image = await loadImageFromBlob(blob);
  const detection = await faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  return detection?.descriptor ?? null;
}

export async function matchFaceBlobAgainstTemplate(
  blob: Blob,
  reference: Float32Array,
): Promise<{ result: FaceMatchResult; score: number; distance: number } | null> {
  const probe = await extractDescriptorFromBlob(blob);
  if (!probe) return null;
  return matchDescriptors(probe, reference);
}
