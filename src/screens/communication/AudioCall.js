import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  SafeAreaView,
} from 'react-native';

export default function IncomingCallScreen({ navigation }) {
  const [isMuted, setIsMuted] = useState(false);
  const [pressedButton, setPressedButton] = useState(null);

  // Accept Call
  const handleAccept = () => {
    navigation.navigate("VideoCallScreen");
  };

  // Decline Call
  const handleDecline = () => {
    navigation.goBack();
  };

  // Mute/Unmute
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.incomingText}>Incoming call</Text>

      {/* Profile Image */}
      <View style={styles.imageContainer}>
        <Image
          source={require('../../assets/images/profile.png')}
          style={styles.profileImage}
        />
      </View>

      {/* Caller Name */}
      <Text style={styles.callerName}>Gallagher, Zorita</Text>

      {/* Action Buttons (Simple Boxes) */}
      <View style={styles.buttonRow}>
        {/* Accept Call */}
        <Pressable
          onPress={handleAccept}
          onPressIn={() => setPressedButton("accept")}
          onPressOut={() => setPressedButton(null)}
          style={[
            styles.boxButton,
            { 
              borderColor: '#4CAF50',
              backgroundColor: pressedButton === "accept" ? '#4CAF50' : 'transparent',
            },
          ]}
        >
          <Image
            source={require('../../assets/images/telephone.png')}
            style={{
              width: 28,
              height: 28,
              tintColor: pressedButton === "accept" ? '#fff' : '#4CAF50',
            }}
            resizeMode="contain"
          />
        </Pressable>

        {/* Mute/Unmute */}
        <Pressable
          onPress={handleMuteToggle}
          onPressIn={() => setPressedButton("mute")}
          onPressOut={() => setPressedButton(null)}
          style={[
            styles.boxButton,
            { 
              borderColor: '#607D8B',
              backgroundColor: pressedButton === "mute" ? '#607D8B' : 'transparent',
            },
          ]}
        >
          <Image
            source={
              isMuted
                ? require('../../assets/images/mute.png')
                : require('../../assets/images/unmute.png')
            }
            style={{
              width: 28,
              height: 28,
              tintColor: pressedButton === "mute" ? '#fff' : '#607D8B',
            }}
            resizeMode="contain"
          />
        </Pressable>

        {/* Decline Call */}
        <Pressable
          onPress={handleDecline}
          onPressIn={() => setPressedButton("decline")}
          onPressOut={() => setPressedButton(null)}
          style={[
            styles.boxButton,
            { 
              borderColor: '#F44336',
              backgroundColor: pressedButton === "decline" ? '#F44336' : 'transparent',
            },
          ]}
        >
          <Image
            source={require('../../assets/images/end.png')}
            style={{
              width: 28,
              height: 28,
              tintColor: pressedButton === "decline" ? '#fff' : '#F44336',
            }}
            resizeMode="contain"
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfdfd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingText: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 20,
  },
  imageContainer: {
    borderRadius: 80,
    padding: 8,
    backgroundColor: '#eee',
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  callerName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 40,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
  },
  boxButton: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderRadius:20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
