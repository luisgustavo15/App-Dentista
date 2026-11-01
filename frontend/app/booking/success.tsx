import Ionicons from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/src/theme";

export default function BookingSuccess() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; time?: string; service?: string }>();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]} testID="booking-success">
      <View style={styles.content}>
        <View style={styles.check}>
          <Ionicons name="checkmark" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Consulta agendada!</Text>
        <Text style={styles.subtitle}>Sua consulta foi criada com status pendente. Entraremos em contato em breve para confirmar.</Text>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryItem}>{params.service}</Text>
          <Text style={styles.summaryMeta}>{params.date?.split("-").reverse().join("/")} às {params.time}</Text>
        </View>
      </View>
      <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
        <Pressable testID="go-appointments" onPress={() => router.replace("/(tabs)/appointments")} style={styles.primary}>
          <Text style={styles.primaryText}>Ver minhas consultas</Text>
        </Pressable>
        <Pressable testID="go-home" onPress={() => router.replace("/(tabs)")} style={styles.secondary}>
          <Text style={styles.secondaryText}>Voltar ao início</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, justifyContent: "space-between" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  check: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  summaryBox: { marginTop: spacing.md, backgroundColor: colors.brandSecondary, padding: spacing.lg, borderRadius: radius.lg, alignItems: "center" },
  summaryItem: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  summaryMeta: { fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 4 },
  primary: { backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: radius.md, alignItems: "center" },
  primaryText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  secondary: { paddingVertical: 14, borderRadius: radius.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
});
