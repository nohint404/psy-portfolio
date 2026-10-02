import type { ComponentProps } from "react";

// Adapted from Pixelact UI's Button registry (MIT; licenses/PixelactUI-MIT.txt).
// Native button + the existing font/tokens replace the unused shadcn/cva layer.
export function PixelButton({ className = "", ...props }: ComponentProps<"button">) {
  return <button className={`pixel-button pixelact-button ${className}`} {...props} />;
}
