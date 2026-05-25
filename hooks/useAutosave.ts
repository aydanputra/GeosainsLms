import { useEffect, useRef, useState, useCallback } from 'react';

// Simple custom debounce hook if package not available
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions<T> {
  onSave: (data: T, signal?: AbortSignal) => Promise<void>;
  delay?: number;
}

export function useAutosave<T>({ onSave, delay = 1500 }: UseAutosaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  
  // Internal state tracking
  const [currentData, setCurrentData] = useState<T | null>(null);
  const debouncedData = useDebouncedValue(currentData, delay);
  const lastSavedDataRef = useRef<T | null>(null);
  
  // Request tracking for anti-stale and aborting
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const triggerSave = useCallback(async (data: T): Promise<boolean> => {
    // Deep compare check (simple JSON stringify for now)
    if (JSON.stringify(data) === JSON.stringify(lastSavedDataRef.current)) {
      return true; // Already saved
    }

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setStatus('saving');
    try {
      // Pass signal to onSave if it accepts it, but here we assume onSave might not, 
      // so we just guard the result. Ideally onSave should take signal.
      await onSave(data, controller.signal);
      
      // Anti-stale guard: If this is not the latest request, ignore result
      if (currentRequestId !== requestIdRef.current) {
        return false; 
      }

      lastSavedDataRef.current = data;
      setLastSavedTime(new Date());
      setStatus('saved');
      return true;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Ignore abort errors
        return false;
      }
      // If valid error and this is latest request
      if (currentRequestId === requestIdRef.current) {
        console.error('Autosave failed:', error);
        setStatus('error');
      }
      return false;
    } finally {
        if (currentRequestId === requestIdRef.current) {
            abortControllerRef.current = null;
        }
    }
  }, [onSave]);

  // Effect to trigger save when debounced value changes
  useEffect(() => {
    if (debouncedData) {
      triggerSave(debouncedData);
    }
  }, [debouncedData, triggerSave]);

  // Function to manually update data (to be called by form onChange)
  const updateData = useCallback((data: T) => {
    setCurrentData(prev => {
      // Deep compare to prevent infinite loops if parent re-renders with new object reference but same content
      // Simple JSON stringify is sufficient for most form data
      if (JSON.stringify(prev) === JSON.stringify(data)) {
        return prev;
      }
      return data;
    });
  }, []);

  return {
    status,
    lastSavedTime,
    updateData,
    triggerSaveNow: () => currentData && triggerSave(currentData), // Force save without debounce
    retry: () => currentData && triggerSave(currentData), // Retry last data
    save: triggerSave // Manually save specific data
  };
}