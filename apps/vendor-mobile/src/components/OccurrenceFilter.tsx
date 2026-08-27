import { StyleSheet, Text, View } from "react-native";
import { Occurrence } from "@indus/shared-types";
import { AnimatedPressable } from "./AnimatedPressable";
import { colors, radius, spacing, type as typeTokens } from "../theme";

export type OccurrenceFilterValue = "ALL" | Occurrence;

const OPTIONS: { value: OccurrenceFilterValue; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: Occurrence.Daily, label: "D" },
  { value: Occurrence.Weekly, label: "W" },
  { value: Occurrence.Monthly, label: "M" },
];

/** Daily/Weekly/Monthly pill filter — shared between Today's Tasks and the Customers list. */
export function OccurrenceFilter({ value, onChange }: { value: OccurrenceFilterValue; onChange: (v: OccurrenceFilterValue) => void }) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <AnimatedPressable
            key={opt.value}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainer,
  },
  pillActive: { backgroundColor: colors.primary },
  label: { ...typeTokens.labelBold, color: colors.inkVariant },
  labelActive: { color: "#fff" },
});
