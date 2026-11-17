export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function filenameFromDisposition(disposition: unknown, fallback: string): string {
  const match = String(disposition ?? "").match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}
