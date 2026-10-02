export default function ChestArt({ open = false, className = "" }: { open?: boolean; className?: string }) {
  return <span className={`pixel-art chest-sprite ${className}`} data-open={open} aria-hidden="true" />;
}
