import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, radius } from "../theme";

/** Animated-width progress bar (no SVG dependency) — used for "today's collection progress" style meters. */
export function ProgressBar({ progress, color = colors.action, track = "rgba(255,255,255,0.24)" }: { progress: number; color?: string; track?: string }) {
  const width = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    Animated.timing(width, { toValue: clamped, duration: 500, useNativeDriver: false }).start();
  }, [clamped, width]);

  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.sm, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.sm },
});
