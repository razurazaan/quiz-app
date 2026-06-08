import { useState, useEffect, useRef, useCallback } from "react";

export const useTimer = (durationSeconds, onExpire) => {
  const [timeLeft, setTimeLeft]     = useState(durationSeconds);
  const [isRunning, setIsRunning]   = useState(false);
  const intervalRef = useRef(null);

  const start = useCallback(() => setIsRunning(true),  []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => { setIsRunning(false); setTimeLeft(durationSeconds); }, [durationSeconds]);

  useEffect(() => {
    if (!isRunning) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current); setIsRunning(false); onExpire?.(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, onExpire]);

  const format = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
      : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  const percentage = ((durationSeconds - timeLeft) / durationSeconds) * 100;
  const isWarning  = timeLeft <= 300 && timeLeft > 60;   // last 5 min
  const isCritical = timeLeft <= 60;                      // last 1 min

  return { timeLeft, isRunning, start, pause, reset, format, formatted: format(timeLeft), percentage, isWarning, isCritical };
};
