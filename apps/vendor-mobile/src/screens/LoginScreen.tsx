import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LabeledInput } from "../components/LabeledInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, type as typeTokens } from "../theme";

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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>IE</Text>
          </View>
          <Text style={styles.title}>Indus ERP</Text>
          <Text style={styles.subtitle}>Collector Login</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

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

          <PrimaryButton title={submitting ? "Signing In…" : "Sign In"} onPress={onSubmit} loading={submitting} />

          <Text style={styles.footer}>Indus ERP Mobile Access{"\n"}Secure Connection Established</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  logoText: { color: "#fff", fontWeight: "700", fontSize: 20 },
  title: { ...typeTokens.headlineMd, color: colors.ink },
  subtitle: { ...typeTokens.bodyMd, color: colors.inkVariant, marginBottom: spacing.md },
  form: { width: "100%", gap: spacing.md },
  error: {
    ...typeTokens.bodySm,
    color: colors.dangerOnContainer,
    backgroundColor: colors.dangerContainer,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: "100%",
  },
  footer: { ...typeTokens.bodySm, color: colors.inkVariant, textAlign: "center", marginTop: spacing.lg },
});
