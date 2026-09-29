let pendingOpen = false;

export const setPendingAbnormalReviewsOpen = () => {
  pendingOpen = true;
};

export const consumePendingAbnormalReviewsOpen = () => {
  const shouldOpen = pendingOpen;
  pendingOpen = false;
  return shouldOpen;
};

export const peekPendingAbnormalReviewsOpen = () => pendingOpen;
