const listeners = new Set();

export const emitAbnormalAssignmentReceived = (payload = {}) => {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.warn('[abnormal-events] listener failed:', error?.message || error);
    }
  });
};

export const subscribeAbnormalAssignmentReceived = (listener) => {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
