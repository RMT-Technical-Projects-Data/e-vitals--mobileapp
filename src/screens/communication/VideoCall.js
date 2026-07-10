import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

export default function VideoCallScreen({ navigation }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [pressedButton, setPressedButton] = useState(null);

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Image
          source={require('../../assets/images/batch_01/back.png')}
          style={{ width: 30, height: 30 }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Main Video Feed */}
      {isVideoOn ? (
        <Image
          source={require('../../assets/images/batch_07/profile.png')}
          style={styles.fullscreenVideo}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.fullscreenVideo, styles.videoOff]}>
          <Image
            source={require('../../assets/images/batch_07/profile.png')}
            style={styles.videoOffIcon}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Your Thumbnail Video */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={require('../../assets/images/batch_07/profile.png')}
          style={styles.thumbnail}
        />
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        {/* Mute / Unmute */}
        <TouchableOpacity
          style={[
            styles.button,
            pressedButton === 'mute' && { backgroundColor: 'green' },
          ]}
          onPress={() => setIsMuted(!isMuted)}
          onPressIn={() => setPressedButton('mute')}
          onPressOut={() => setPressedButton(null)}
        >
          <Image
            source={
              isMuted
                ? require('../../assets/images/batch_06/mute.png')
                : require('../../assets/images/batch_08/unmute.png')
            }
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Video On / Off */}
        <TouchableOpacity
          style={[
            styles.button,
            pressedButton === 'video' && { backgroundColor: 'blue' },
          ]}
          onPress={() => setIsVideoOn(!isVideoOn)}
          onPressIn={() => setPressedButton('video')}
          onPressOut={() => setPressedButton(null)}
        >
          <Image
            source={
              isVideoOn
                ? require('../../assets/images/batch_09/videoon.png')
                : require('../../assets/images/batch_09/videooff.png')
            }
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* End Call */}
        <TouchableOpacity
          style={[
            styles.button,
            pressedButton === 'end' && { backgroundColor: 'red' },
          ]}
          onPress={() => navigation.goBack()}
          onPressIn={() => setPressedButton('end')}
          onPressOut={() => setPressedButton(null)}
        >
          <Image
            source={require('../../assets/images/batch_03/end.png')}
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
  },
  fullscreenVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoOff: {
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOffIcon: {
    width: 100,
    height: 100,
    opacity: 0.5,
  },
  thumbnailContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 90,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 30,
  },
  button: {
    backgroundColor: 'lightgrey',
    padding: 15,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
