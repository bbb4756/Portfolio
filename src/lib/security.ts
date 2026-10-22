import { RepositoryError } from "./repository";

export function assertSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") throw new RepositoryError("Cross-site request rejected", 403);
  const origin = request.headers.get("origin");
  if (!origin) {
    if (process.env.NODE_ENV === "production") throw new RepositoryError("Origin header is required", 403);
    return;
  }
  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!requestHost || new URL(origin).host !== requestHost) throw new RepositoryError("Request origin does not match host", 403);
}

export function validateMediaSignature(bytes: Buffer, mime: string) {
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString("ascii");
  const hex = bytes.subarray(0, 12).toString("hex");
  const valid =
    (mime === "image/png" && hex.startsWith("89504e470d0a1a0a")) ||
    (mime === "image/jpeg" && hex.startsWith("ffd8ff")) ||
    (mime === "image/gif" && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) ||
    (mime === "image/webp" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") ||
    (mime === "video/mp4" && ascii(4, 8) === "ftyp") ||
    (mime === "video/webm" && hex.startsWith("1a45dfa3"));
  if (!valid) throw new RepositoryError("File signature does not match the declared media type", 415);
}
