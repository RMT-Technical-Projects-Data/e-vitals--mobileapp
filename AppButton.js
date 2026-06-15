// components/AppButton.js
import React from "react";
import { TouchableOpacity, Text, StyleSheet, Dimensions } from "react-native";
import { colors } from "../config/globall";

// Get device width & height
const { width, height } = Dimensions.get("window");
const scaleWidth = (size) => (width / 375) * size;   // 375 is base iPhone width
const scaleHeight = (size) => (height / 812) * size; // 812 is base iPhone height

export default function AppButton({ title, onPress, color = "primary", style }) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors[color] }, style]}
      onPress={onPress}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleWidth(8),
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: colors.white,
    fontSize: scaleWidth(16),
    fontWeight: "bold",
  },
});
