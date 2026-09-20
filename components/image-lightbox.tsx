"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* The click-to-enlarge popup for images inside notes and comments: a
   dark backdrop with the image at (up to) full size, closed by clicking
   anywhere, the X, or Escape. A click-delegation lightbox rather than a
   real link around the image, because lib/sanitize-note-html.ts's
   allowlist deliberately blocks a data: scheme on <a href> -- a pasted
   screenshot has no other URL to link to. */
export function ImageLightbox({ src, onClose, onDownload }: { src: string; onClose: () => void; onDownload?: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex cursor-zoom-out items-center justify-center bg-black/80 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Image preview">
      <div className="absolute right-4 top-4 flex gap-2">
        {onDownload && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
            aria-label="Download this image"
            title="Download to your device"
            className="flex h-9 items-center gap-1.5 rounded-full bg-black/50 px-3 text-sm text-white hover:bg-black/70"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image preview"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI, not something next/image can optimize. */}
      <img src={src} alt="" className="max-h-full max-w-full rounded object-contain" />
    </div>
  );
}

/* Renders already-sanitized note HTML (see lib/sanitize-note-html.ts --
   the caller must only ever pass text that went through it) and turns a
   click on any image inside it into the popup view above. */
export function ZoomableHtml({ html, className }: { html: string; className?: string }) {
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);
  return (
    <>
      <div
        className={cn(className, "[&_img]:cursor-zoom-in")}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.tagName === "IMG") setZoomedSrc((target as HTMLImageElement).src);
        }}
      />
      {zoomedSrc && <ImageLightbox src={zoomedSrc} onClose={() => setZoomedSrc(null)} />}
    </>
  );
}
