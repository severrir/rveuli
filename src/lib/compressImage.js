/**
 * Shrink a photo before it is uploaded.
 *
 * Reps post pictures of textbook pages straight from the camera, which on a
 * modern phone means four to eight megabytes. Everyone in the class then
 * downloads that over mobile data to read six lines of exercises. Resizing
 * to a readable 1600px and re-encoding typically takes it under 400KB.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function compressImage(file) {
  if (!file.type.startsWith("image/")) return null;
  // Already small, or a format canvas would damage.
  if (file.size < 350_000 || file.type === "image/gif") return null;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );

    // Never hand back something larger than what we started with.
    return blob && blob.size < file.size ? blob : null;
  } catch {
    // Compression is an optimisation; the original upload still works.
    return null;
  }
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} ბაიტი`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} კბ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} მბ`;
}
