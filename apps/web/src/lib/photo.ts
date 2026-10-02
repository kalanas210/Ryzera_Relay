/** A photo shrunk on the device before it is sent: the longest side to 1280 px, as a JPEG, so the dock tablet and
 *  the phones send a fraction of what the camera took. Where the browser cannot decode the file it goes as it is,
 *  and Relay says if it cannot take it. */
export async function shrinkPhoto(file: Blob, longest = 1280, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** The types Relay keeps a photo in. */
export const PHOTO_TYPES = ["image/jpeg", "image/webp", "image/png"];
