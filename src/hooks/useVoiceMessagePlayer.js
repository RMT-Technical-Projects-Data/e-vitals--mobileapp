import { useCallback, useEffect, useRef, useState } from 'react';
import audioRecorderPlayer from '../utils/audioRecorderPlayer';

export default function useVoiceMessagePlayer() {
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const activeMessageIdRef = useRef(null);

  const stopPlayback = useCallback(async () => {
    try {
      audioRecorderPlayer.removePlayBackListener();
      await audioRecorderPlayer.stopPlayer();
    } catch (error) {
      // no active player
    }
    setIsPlaying(false);
    setCurrentMs(0);
    setDurationMs(0);
    setActiveMessageId(null);
    activeMessageIdRef.current = null;
  }, []);

  useEffect(() => () => {
    stopPlayback();
  }, [stopPlayback]);

  const playMessage = useCallback(async (messageId, playUrl, totalDurationSec = 0) => {
    if (!playUrl) return;

    if (activeMessageIdRef.current && String(activeMessageIdRef.current) !== String(messageId)) {
      await stopPlayback();
    }

    if (activeMessageIdRef.current === String(messageId) && isPlaying) {
      await stopPlayback();
      return;
    }

    await stopPlayback();

    activeMessageIdRef.current = String(messageId);
    setActiveMessageId(String(messageId));
    setDurationMs(Math.max(0, Number(totalDurationSec) || 0) * 1000);
    setIsPlaying(true);

    await audioRecorderPlayer.startPlayer(playUrl);
    audioRecorderPlayer.addPlayBackListener((event) => {
      setCurrentMs(event.currentPosition || 0);
      if (event.duration) {
        setDurationMs(event.duration);
      }
      if (event.currentPosition >= event.duration && event.duration > 0) {
        stopPlayback();
      }
    });
  }, [isPlaying, stopPlayback]);

  return {
    activeMessageId,
    isPlaying,
    currentMs,
    durationMs,
    playMessage,
    stopPlayback,
  };
}
