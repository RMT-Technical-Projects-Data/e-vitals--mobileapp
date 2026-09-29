import AudioRecorderPlayer from 'react-native-audio-recorder-player';

// Single shared instance — recorder and player must not use separate instances.
const audioRecorderPlayer = new AudioRecorderPlayer();

export default audioRecorderPlayer;
