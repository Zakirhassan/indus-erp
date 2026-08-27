import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "./Icon";
import { AnimatedPressable } from "./AnimatedPressable";
import { colors, radius, spacing, type as typeTokens } from "../theme";

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
  /** Extra text to match against when searching (e.g. phone number, serial no) but not shown as the label. */
  keywords?: string;
}

export function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  searchable,
}: {
  label?: string;
  placeholder?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const filtered = searchable
    ? options.filter((o) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return o.label.toLowerCase().includes(q) || (o.keywords?.toLowerCase().includes(q) ?? false);
      })
    : options;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
      <AnimatedPressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.value : styles.placeholder} numberOfLines={1}>
          {selected ? selected.label : (placeholder ?? "Select…")}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.inkVariant} />
      </AnimatedPressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            {searchable ? (
              <View style={styles.searchWrap}>
                <Icon name="search" size={16} color={colors.inkVariant} />
                <TextInput
                  style={styles.search}
                  placeholder="Search…"
                  placeholderTextColor={colors.inkVariant}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                />
              </View>
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    style={styles.option}
                    onPress={() => {
                      onChange(item.value);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>{item.label}</Text>
                      {item.subtitle ? <Text style={styles.optionSubtitle}>{item.subtitle}</Text> : null}
                    </View>
                    {isSelected ? <Icon name="checkmark-circle" size={20} color={colors.action} /> : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No matches</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typeTokens.labelBold, color: colors.inkVariant },
  input: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceLowest,
  },
  value: { ...typeTokens.bodyMd, color: colors.ink, flex: 1 },
  placeholder: { ...typeTokens.bodyMd, color: colors.inkVariant, flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceLowest,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: "70%",
    paddingTop: spacing.sm,
  },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  search: { flex: 1, ...typeTokens.bodyMd, color: colors.ink, padding: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  optionLabel: { ...typeTokens.bodyMd, color: colors.ink },
  optionSubtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  empty: { ...typeTokens.bodyMd, color: colors.inkVariant, textAlign: "center", padding: spacing.lg },
});
