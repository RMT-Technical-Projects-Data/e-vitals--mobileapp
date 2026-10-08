import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const formatDuration = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatMs = (ms) => formatDuration(Math.floor((Number(ms) || 0) / 1000));

export default function VoiceMessageBubble({
  message,
  isMine,
  isActive,
  isPlaying,
  isLoading,
  currentMs,
  durationMs,
  onPlayPress,
  accentColor,
  textDark,
  textMuted,
}) {
  const totalDurationSec = message.audio_duration || Math.floor((durationMs || 0) / 1000);
  const progress = durationMs > 0 ? Math.min(1, (currentMs || 0) / durationMs) : 0;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.playButton, { backgroundColor: isMine ? '#0b1f3f' : accentColor }]}
        onPress={onPlayPress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialIcons
            name={isActive && isPlaying ? 'pause' : 'play-arrow'}
            size={22}
            color="#fff"
          />
        )}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.track, { backgroundColor: isMine ? 'rgba(255,255,255,0.38)' : 'rgba(11,31,63,0.12)' }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.max(progress * 100, isActive ? 8 : 0)}%`,
                backgroundColor: isMine ? '#fff' : accentColor,
              },
            ]}
          />
        </View>
        <Text style={[styles.duration, { color: isMine ? 'rgba(255,255,255,0.85)' : textMuted }]}>
          {isActive ? `${formatMs(currentMs)} / ${formatDuration(totalDurationSec)}` : formatDuration(totalDurationSec)}
        </Text>
      </View>

      <MaterialIcons
        name="mic"
        size={16}
        color={isMine ? 'rgba(255,255,255,0.75)' : textMuted}
        style={styles.micIcon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 180,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 6,
  },
  fill: {
    height: 4,
    borderRadius: 999,
  },
  duration: {
    fontSize: 11,
    fontWeight: '600',
  },
  micIcon: {
    marginLeft: 8,
  },
});
