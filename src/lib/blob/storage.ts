import { put } from "@vercel/blob";

export async function uploadScreenshot(
  buffer: Buffer,
  path: string
): Promise<string> {
  const { url } = await put(path, buffer, {
    access: "public",
    contentType: "image/png",
  });
  return url;
}

export async function uploadHtml(html: string, path: string): Promise<string> {
  const { url } = await put(path, html, {
    access: "public",
    contentType: "text/html",
  });
  return url;
}

export async function fetchAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function fetchAsBase64(url: string): Promise<string | null> {
  const buffer = await fetchAsBuffer(url);
  if (!buffer) return null;
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
