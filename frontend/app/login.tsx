import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1000&q=80";

type Mode = "login" | "register" | "admin";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register, adminLogin } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setPassword("");
  };

  const validate = (): string | null => {
    if (mode === "admin") return password ? null : "Digite a senha de acesso";
    if (mode === "register" && name.trim().length < 2) return "Digite seu nome completo";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Digite um e-mail válido";
    if (mode === "register" && password.length < 6) return "A senha precisa ter pelo menos 6 caracteres";
    if (!password) return "Digite sua senha";
    return null;
  };

  const onSubmit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else if (mode === "register") await register({ name: name.trim(), email, password, phone: phone.trim() || undefined });
      else await adminLogin(password);
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Acesso administrativo";
  const cta = mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Acessar painel";

  return (
    <View style={styles.root} testID="login-screen">
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["rgba(26,115,232,0.75)", "rgba(23,78,166,0.95)"]} style={StyleSheet.absoluteFill} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={styles.topArea}>
          <View style={styles.logoBadge}>
            <Ionicons name="medkit" size={34} color={colors.brandPrimary} />
          </View>
          <Text style={styles.brand}>Dr. Jocélio</Text>
          <Text style={styles.subtitle}>Clínica Odontológica</Text>
        </View>

        <View style={styles.card}>
          {mode !== "admin" ? (
            <View style={styles.segment}>
              {(["login", "register"] as const).map((m) => (
                <Pressable
                  key={m}
                  testID={`mode-${m}`}
                  onPress={() => switchMode(m)}
                  style={[styles.segmentItem, mode === m && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                    {m === "login" ? "Entrar" : "Criar conta"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.adminHead}>
              <Ionicons name="shield-checkmark" size={22} color={colors.brandPrimary} />
              <Text style={styles.title}>{title}</Text>
            </View>
          )}

          {mode === "register" && (
            <>
              <Field icon="person-outline" placeholder="Nome completo" value={name} onChangeText={setName} testID="input-name" autoCapitalize="words" />
              <Field icon="call-outline" placeholder="Telefone (opcional)" value={phone} onChangeText={setPhone} testID="input-phone" keyboardType="phone-pad" />
            </>
          )}
          {mode !== "admin" && (
            <Field
              icon="mail-outline"
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              testID="input-email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
            <TextInput
              testID="input-password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === "admin" ? "Senha de acesso" : "Senha"}
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              onSubmitEditing={onSubmit}
              returnKeyType="go"
              style={styles.input}
            />
            <Pressable testID="toggle-password" onPress={() => setShowPw((v) => !v)} hitSlop={10}>
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.muted} />
            </Pressable>
          </View>

          {error && (
            <View style={styles.errorBox} testID="login-error">
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            testID="login-submit-button"
            onPress={onSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.submit, (pressed || loading) && { opacity: 0.85 }]}
          >
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.submitText}>{cta}</Text>}
          </Pressable>

          <Pressable
            testID={mode === "admin" ? "back-to-patient" : "go-admin"}
            onPress={() => switchMode(mode === "admin" ? "login" : "admin")}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>
              {mode === "admin" ? "Voltar para o acesso do paciente" : "Sou da clínica — acesso administrativo"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({ icon, testID, ...props }: { icon: any; testID: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <TextInput testID={testID} placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary },
  scroll: { flexGrow: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl, gap: spacing.xl },
  topArea: { alignItems: "center" },
  logoBadge: {
    width: 76, height: 76, borderRadius: 24, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  brand: { color: colors.onBrandPrimary, fontSize: 34, fontWeight: "800" },
  subtitle: { color: colors.onBrandPrimary, opacity: 0.9, fontSize: 16, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: "center" },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  segmentTextActive: { color: colors.onBrandPrimary },
  adminHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, minHeight: 50, backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: 15, color: colors.onSurface, paddingVertical: spacing.md },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { color: colors.error, fontSize: 13, flex: 1 },
  submit: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.md, minHeight: 52,
    alignItems: "center", justifyContent: "center",
  },
  submitText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "800" },
  linkBtn: { alignItems: "center", paddingVertical: spacing.sm, minHeight: 44, justifyContent: "center" },
  linkText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "600" },
});
