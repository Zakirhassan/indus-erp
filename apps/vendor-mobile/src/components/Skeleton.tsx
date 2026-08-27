import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, radius } from "../theme";

/** Shimmering placeholder block — used in place of a bare spinner while a screen's first data load is in flight. */
export function Skeleton({ width = "100%", height = 16, borderRadius = radius.sm }: { width?: number | `${number}%`; height?: number; borderRadius?: number }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[styles.block, { width, height, borderRadius, opacity: pulse }]} />;
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <View style={[styles.card, { height }]}>
      <Skeleton width="60%" height={14} />
      <Skeleton width="40%" height={22} />
      <Skeleton width="80%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceContainer },
  card: { flex: 1, borderRadius: radius.xxl, backgroundColor: colors.surfaceLowest, padding: 16, gap: 10, justifyContent: "center" },
});
