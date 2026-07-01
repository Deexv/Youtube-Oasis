"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * useLocalStorage — a useState hook that persists to localStorage.
 *
 * The value is saved on every change and restored on mount.
 * If localStorage is unavailable (SSR, private browsing), it falls back
 * to regular useState.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStored(JSON.parse(item));
      }
    } catch {
      // localStorage not available or JSON parse error — use initial value
    }
    setHydrated(true);
  }, [key]);

  // Save to localStorage on change
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // localStorage full or unavailable — ignore
        }
        return next;
      });
    },
    [key],
  );

  return [stored, setValue];
}
