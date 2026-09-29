import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import audioRecorderPlayer from '../utils/audioRecorderPlayer';

const requestMicrophonePermission = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone permission',
        message: 'eVitals needs microphone access to record voice messages.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

export default function useVoiceMessageRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [recordedFile, setRecordedFile] = useState(null);
  const recordPathRef = useRef(null);

  const cleanupRecorder = useCallback(async () => {
    try {
      audioRecorderPlayer.removeRecordBackListener();
      await audioRecorderPlayer.stopRecorder();
    } catch (error) {
      // no active recording
    }
    setIsRecording(false);
    setDurationMs(0);
    recordPathRef.current = null;
  }, []);

  useEffect(() => () => {
    cleanupRecorder();
  }, [cleanupRecorder]);

  const startRecording = useCallback(async () => {
    const allowed = await requestMicrophonePermission();
    if (!allowed) {
      throw new Error('Microphone permission denied');
    }

    await cleanupRecorder();

    // Android: omit path so nitro-sound writes to app filesDir (writable).
    // A bare filename like "voice-123.m4a" hits the read-only root filesystem.
    const recordPath = Platform.OS === 'ios' ? `voice-${Date.now()}.m4a` : undefined;

    const uri = await audioRecorderPlayer.startRecorder(recordPath, {
      AVFormatIDKeyIOS: 'aac',
      AVNumberOfChannelsKeyIOS: 1,
      AVSampleRateKeyIOS: 44100,
      AudioEncoderAndroid: 3,
      AudioSourceAndroid: 1,
      OutputFormatAndroid: 2,
    });

    recordPathRef.current = uri;
    setRecordedFile(null);
    setIsRecording(true);
    setDurationMs(0);

    audioRecorderPlayer.addRecordBackListener((event) => {
      setDurationMs(event.currentPosition || 0);
      return;
    });
  }, [cleanupRecorder]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return null;

    audioRecorderPlayer.removeRecordBackListener();
    const result = await audioRecorderPlayer.stopRecorder();
    const finalPath = result || recordPathRef.current;
    setIsRecording(false);
    setRecordedFile(finalPath);
    return {
      uri: finalPath,
      durationSec: Math.max(1, Math.round((durationMs || 0) / 1000)),
    };
  }, [durationMs, isRecording]);

  const cancelRecording = useCallback(async () => {
    await cleanupRecorder();
    setRecordedFile(null);
  }, [cleanupRecorder]);

  return {
    isRecording,
    durationMs,
    recordedFile,
    startRecording,
    stopRecording,
    cancelRecording,
    cleanupRecorder,
  };
}
