import { useEffect, useRef } from "react";

export function usePrevious<TValue>(value: TValue) {
  const previousValueRef = useRef<TValue | undefined>(undefined);

  useEffect(() => {
    previousValueRef.current = value;
  }, [value]);

  return previousValueRef.current;
}
