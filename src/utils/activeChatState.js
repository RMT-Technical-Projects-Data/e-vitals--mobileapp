let activeChatUserId = null;

export const setActiveChatUserId = (userId) => {
  activeChatUserId = userId ? String(userId) : null;
};

export const getActiveChatUserId = () => activeChatUserId;
