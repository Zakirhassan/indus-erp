import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing, type as typeTokens } from "../theme";

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
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
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.value : styles.placeholder}>{selected ? selected.label : placeholder ?? "Select…"}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {searchable ? (
              <TextInput
                style={styles.search}
                placeholder="Search…"
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {item.subtitle ? <Text style={styles.optionSubtitle}>{item.subtitle}</Text> : null}
                </Pressable>
              )}
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceLowest,
  },
  value: { ...typeTokens.bodyMd, color: colors.ink },
  placeholder: { ...typeTokens.bodyMd, color: colors.inkVariant },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "70%",
    paddingTop: spacing.md,
  },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  option: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  optionLabel: { ...typeTokens.bodyMd, color: colors.ink },
  optionSubtitle: { ...typeTokens.bodySm, color: colors.inkVariant },
  empty: { ...typeTokens.bodyMd, color: colors.inkVariant, textAlign: "center", padding: spacing.lg },
});
