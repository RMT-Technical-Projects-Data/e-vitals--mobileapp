import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

const PatientSessionTimerContext = createContext(null);

export function PatientSessionTimerProvider({ children }) {
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [activePatientId, setActivePatientId] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  const startSession = useCallback((patientId) => {
    const id = String(patientId);
    setActivePatientId((current) => {
      if (current !== id) {
        setTimer(0);
      }
      return id;
    });
    setIsRunning(true);
  }, []);

  const endSession = useCallback(() => {
    setIsRunning(false);
    setTimer(0);
    setActivePatientId(null);
  }, []);

  return (
    <PatientSessionTimerContext.Provider
      value={{
        timer,
        setTimer,
        isRunning,
        setIsRunning,
        activePatientId,
        startSession,
        endSession,
      }}
    >
      {children}
    </PatientSessionTimerContext.Provider>
  );
}

export const usePatientSessionTimer = () => {
  const context = useContext(PatientSessionTimerContext);
  if (!context) {
    throw new Error('usePatientSessionTimer must be used within PatientSessionTimerProvider');
  }
  return context;
};
