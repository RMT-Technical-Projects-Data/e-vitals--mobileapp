let pendingOpenUserId = null;

export const setPendingChatOpenUserId = (userId) => {
  if (userId != null && String(userId).trim()) {
    pendingOpenUserId = String(userId);
  }
};

export const consumePendingChatOpenUserId = () => {
  const userId = pendingOpenUserId;
  pendingOpenUserId = null;
  return userId;
};

export const peekPendingChatOpenUserId = () => pendingOpenUserId;
