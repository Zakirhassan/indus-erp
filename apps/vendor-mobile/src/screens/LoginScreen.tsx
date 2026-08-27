import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { LabeledInput } from "../components/LabeledInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { colors, gradients, radius, shadow, spacing, type as typeTokens } from "../theme";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your collector ID and password");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LinearGradient colors={gradients.hero} style={styles.screen} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Text style={styles.logoText}>IE</Text>
          </View>
          <Text style={styles.brandTitle}>Indus ERP</Text>
          <Text style={styles.brandSubtitle}>Collector Access</Text>

          <View style={[styles.card, shadow.lg]}>
            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle" size={16} color={colors.dangerOnContainer} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <LabeledInput
                label="Collector ID"
                placeholder="e.g. collector@indus.local"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <LabeledInput
                label="Password"
                placeholder="Enter your PIN or password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <PrimaryButton title={submitting ? "Signing In…" : "Sign In"} onPress={onSubmit} loading={submitting} icon="log-in-outline" />
          </View>

          <View style={styles.footerRow}>
            <Icon name="shield-checkmark-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.footer}>Secure connection established</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.xxl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  logoText: { color: "#fff", fontWeight: "700", fontSize: 22 },
  brandTitle: { ...typeTokens.headlineMd, color: "#fff" },
  brandSubtitle: { ...typeTokens.bodyMd, color: "rgba(255,255,255,0.75)", marginBottom: spacing.xl },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  form: { width: "100%", gap: spacing.md },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.dangerContainer,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  error: { ...typeTokens.bodySm, color: colors.dangerOnContainer, flex: 1 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xl },
  footer: { ...typeTokens.bodySm, color: "rgba(255,255,255,0.7)" },
});
