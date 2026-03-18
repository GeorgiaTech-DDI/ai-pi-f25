"use client";

import { useState, useEffect, useCallback } from "react";

// 1. Fix the "No overload matches this call" error by
//    telling TypeScript our custom event exists.
declare global {
  interface WindowEventMap {
    "local-storage": CustomEvent;
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Utility to safely read from localStorage
  const readValue = useCallback((): T => {
    // Prevent errors during Server-Side Rendering (Next.js)
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  // Initialize state with the value from storage (or initialValue)
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Persistence logic
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Handle functional updates like setValue(prev => prev + 1)
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        // Update React State
        setStoredValue(valueToStore);

        // Save to Local Storage
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));

          // Notify other instances of this hook in the SAME tab
          window.dispatchEvent(new CustomEvent("local-storage"));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key “${key}”:`, error);
      }
    },
    [key, storedValue],
  );

  // Sync state if the key changes
  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue, key]);

  // Listen for changes (cross-tab and same-tab)
  useEffect(() => {
    const handleStorageChange = (e: Event) => {
      // If it's a native StorageEvent (from another tab), check the key
      if (e instanceof StorageEvent && e.key !== key) return;

      // Update state
      setStoredValue(readValue());
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("local-storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("local-storage", handleStorageChange);
    };
  }, [key, readValue]);

  return [storedValue, setValue] as const;
}
