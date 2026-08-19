import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, ReactNode, RefObject } from "react";

interface VirtualRowsProps {
  scrollRef: RefObject<HTMLElement | null>;
  count: number;
  estimateSize: number;
  getKey: (index: number) => string;
  renderRow: (index: number) => ReactNode;
  className?: string;
  gap?: number;
  overscan?: number;
}

/**
 * Renders a large list inside an existing scroll container, mounting only the
 * rows visible in the viewport. The scroll container is provided via `scrollRef`
 * so callers keep their existing shell styling/scrollbars. Rows may have
 * variable heights; they are measured after mount.
 */
export function VirtualRows({
  scrollRef,
  count,
  estimateSize,
  getKey,
  renderRow,
  className,
  gap = 0,
  overscan = 8
}: VirtualRowsProps) {
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    getItemKey: getKey,
    estimateSize: () => estimateSize,
    overscan
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      className={className}
      style={{
        position: "relative",
        height: `${virtualizer.getTotalSize()}px`,
        width: "100%"
      }}
    >
      {virtualItems.map((item) => {
        const style: CSSProperties = {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          paddingBottom: gap ? `${gap}px` : undefined,
          transform: `translateY(${item.start}px)`
        };
        return (
          <div
            data-index={item.index}
            key={getKey(item.index)}
            ref={virtualizer.measureElement}
            style={style}
          >
            {renderRow(item.index)}
          </div>
        );
      })}
    </div>
  );
}
