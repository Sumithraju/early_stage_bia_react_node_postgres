import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const MIN_USABLE_WIDTH = 220;

export function ChartFrame({
  height,
  children,
  className = "chart",
}) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  const measure = useCallback(() => {
    const element = ref.current;

    if (!element) return;

    const next = Math.floor(
      element.getBoundingClientRect().width,
    );

    setWidth((current) =>
      current === next ? current : next,
    );
  }, []);

  useLayoutEffect(measure);

  useEffect(() => {
    window.addEventListener("resize", measure);

    return () =>
      window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div
      className={className}
      ref={ref}
      style={{ minHeight: height }}
    >
      {width >= MIN_USABLE_WIDTH
        ? children(width)
        : null}
    </div>
  );
}
