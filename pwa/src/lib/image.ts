const MAX_DIMENSION = 1920;
const MAX_BYTES = 1024 * 1024;
const INITIAL_QUALITY = 0.75;
const MIN_QUALITY = 0.4;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("CANVAS_BLOB_FAILED"));
      },
      "image/jpeg",
      quality,
    );
  });
}

function scaleDimensions(width: number, height: number, maxDim: number) {
  if (width <= maxDim && height <= maxDim) {
    return { width, height };
  }
  const scale = maxDim / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/** Compresse une photo : JPEG, max 1920px, ≤ 1 Mo, sans métadonnées EXIF. */
export async function compressPhoto(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  let { width, height } = scaleDimensions(bitmap.width, bitmap.height, MAX_DIMENSION);

  const render = async (targetWidth: number, targetHeight: number, quality: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("CANVAS_CONTEXT_FAILED");
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    return canvasToBlob(canvas, quality);
  };

  let quality = INITIAL_QUALITY;
  let blob = await render(width, height, quality);

  while (blob.size > MAX_BYTES && quality > MIN_QUALITY) {
    quality -= 0.05;
    blob = await render(width, height, quality);
  }

  while (blob.size > MAX_BYTES && width > 640 && height > 640) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    blob = await render(width, height, quality);
  }

  bitmap.close();
  return blob;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}
