import { useMemo } from "react";

type MediaType = "image" | "video" | "vimeo" | "gif";

interface MediaRendererProps {
  url: string;
  alt?: string;
  className?: string;
  aspectRatio?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  fallbackUrl?: string;
  overlay?: boolean;
  "data-testid"?: string;
}

function detectMediaType(url: string): MediaType {
  if (!url) return "image";
  const lower = url.toLowerCase();

  if (lower.includes("vimeo.com") || lower.includes("player.vimeo.com")) {
    return "vimeo";
  }

  const ext = lower.split("?")[0].split(".").pop() || "";
  if (["mp4", "webm", "ogg", "mov"].includes(ext)) return "video";
  if (ext === "gif") return "gif";
  return "image";
}

function getVimeoEmbedUrl(url: string): string {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (match) {
    return `https://player.vimeo.com/video/${match[1]}?autoplay=1&loop=1&muted=1&background=1`;
  }
  if (url.includes("player.vimeo.com")) {
    const hasParams = url.includes("?");
    return hasParams ? url : `${url}?autoplay=1&loop=1&muted=1&background=1`;
  }
  return url;
}

export function MediaRenderer({
  url,
  alt = "",
  className = "",
  autoPlay = true,
  loop = true,
  muted = true,
  fallbackUrl,
  overlay = false,
  "data-testid": testId,
}: MediaRendererProps) {
  const mediaType = useMemo(() => detectMediaType(url), [url]);
  const effectiveUrl = url || fallbackUrl;

  if (!effectiveUrl) return null;

  const finalType = url ? mediaType : detectMediaType(fallbackUrl || "");

  const wrapperClass = overlay
    ? `absolute inset-0 w-full h-full ${className}`
    : className;

  if (finalType === "vimeo") {
    const embedUrl = getVimeoEmbedUrl(effectiveUrl);
    return (
      <div className={`${wrapperClass} relative overflow-hidden`} data-testid={testId}>
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          style={{ border: 0, transform: "scale(1.2)", transformOrigin: "center" }}
          allow="autoplay; fullscreen"
          allowFullScreen
          title={alt}
        />
      </div>
    );
  }

  if (finalType === "video") {
    return (
      <video
        className={`${wrapperClass} object-cover`}
        src={effectiveUrl}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        data-testid={testId}
      />
    );
  }

  return (
    <img
      src={effectiveUrl}
      alt={alt}
      className={`${wrapperClass} object-cover`}
      data-testid={testId}
    />
  );
}

export function MediaPreview({
  url,
  className = "aspect-video",
  "data-testid": testId,
}: {
  url: string;
  className?: string;
  "data-testid"?: string;
}) {
  const mediaType = useMemo(() => detectMediaType(url), [url]);

  if (!url) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center rounded-md`} data-testid={testId}>
        <span className="text-xs text-muted-foreground">No media</span>
      </div>
    );
  }

  if (mediaType === "vimeo") {
    const embedUrl = getVimeoEmbedUrl(url);
    return (
      <div className={`${className} relative overflow-hidden rounded-md`} data-testid={testId}>
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen"
          title="Preview"
        />
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <div className={`${className} relative overflow-hidden rounded-md bg-muted`} data-testid={testId}>
        <video
          src={url}
          className="w-full h-full object-cover"
          muted
          loop
          autoPlay
          playsInline
        />
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden rounded-md bg-muted`} data-testid={testId}>
      <img
        src={url}
        alt="Preview"
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}

export { detectMediaType, getVimeoEmbedUrl };
