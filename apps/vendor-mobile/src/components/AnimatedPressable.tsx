import { useRef } from "react";
import { Animated, Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

/**
 * Drop-in Pressable with a spring press-scale — the one micro-interaction every tappable
 * card/row/button in the app shares, so touch feedback feels consistent everywhere.
 */
export function AnimatedPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  ...rest
}: Omit<PressableProps, "children" | "style"> & { children?: React.ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn(e: GestureResponderEvent) {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    onPressIn?.(e);
  }
  function pressOut(e: GestureResponderEvent) {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    onPressOut?.(e);
  }

  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
