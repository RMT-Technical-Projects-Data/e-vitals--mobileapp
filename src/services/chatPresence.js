let chatScreenFocused = false;
let activePeerId = null;

export function setChatScreenFocused(focused) {
  chatScreenFocused = Boolean(focused);
}

export function setActiveChatPeer(peerId) {
  activePeerId = peerId == null || peerId === '' ? null : String(peerId);
}

/**
 * The chat screen already shows an in-app banner while it is open.
 * A system alert is only needed when that screen is not in front.
 */
export function shouldShowChatAlert(fromUserId) {
  if (fromUserId == null || fromUserId === '') return false;
  if (chatScreenFocused) return false;
  if (activePeerId && activePeerId === String(fromUserId)) return false;
  return true;
}
