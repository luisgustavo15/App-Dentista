import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useAuth } from "@/src/auth/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBkZW50YWwlMjBjbGluaWMlMjBpbnRlcmlvcnxlbnwwfHx8fDE3OTM1NDIwOTR8MA&ixlib=rb-4.1.0&q=85";

export default function LoginScreen() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    try {
      await login();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(26,115,232,0.75)", "rgba(23,78,166,0.95)"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topArea}>
          <View style={styles.logoBadge}>
            <Ionicons name="medkit" size={34} color={colors.brandPrimary} />
          </View>
          <Text style={styles.brand}>Dr. Jocélio</Text>
          <Text style={styles.subtitle}>Clínica Odontológica</Text>
        </View>

        <View style={styles.bottomCard}>
          <Text style={styles.welcome}>Seu sorriso em boas mãos</Text>
          <Text style={styles.lead}>
            Agende consultas, acompanhe seu histórico e cuide da sua saúde bucal em um só lugar.
          </Text>

          <Pressable
            testID="login-google-button"
            onPress={onLogin}
            disabled={loading}
            style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.9 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onSurface} />
            ) : (
              <>
                <View style={styles.gIcon}>
                  <Text style={styles.gIconText}>G</Text>
                </View>
                <Text style={styles.googleText}>Entrar com Google</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.terms}>
            Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandPrimary },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl },
  topArea: { alignItems: "center", marginTop: spacing["3xl"] },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  brand: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", letterSpacing: 0.5 },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: 16, marginTop: 4 },
  bottomCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  welcome: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  lead: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  googleBtn: {
    marginTop: spacing.sm,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    minHeight: 52,
  },
  gIcon: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "#4285F4",
    alignItems: "center", justifyContent: "center",
  },
  gIconText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  googleText: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  terms: { fontSize: 11, color: colors.muted, textAlign: "center", marginTop: spacing.sm },
});
