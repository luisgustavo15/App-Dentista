import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type ClinicInfo } from "@/src/api/client";
import { radius, spacing, makeStyles, useTheme, type ThemeColors } from "@/src/theme";

export default function ContactScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["clinic"], queryFn: () => api.get<ClinicInfo>("/clinic") });

  const openWhatsApp = () => {
    if (!data) return;
    const phone = data.whatsapp.replace(/\D/g, "");
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent("Olá, gostaria de informações sobre a clínica")}`);
  };
  const openCall = () => data && Linking.openURL(`tel:${data.phone.replace(/\D/g, "")}`);
  const openEmail = () => data && Linking.openURL(`mailto:${data.email}`);
  const openMap = () => data && Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address)}`);

  return (
    <View style={styles.root} testID="contact-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Contato</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}>
        {data && (
          <>
            <View style={styles.heroCard}>
              <Ionicons name="medkit" size={28} color={colors.onBrandPrimary} />
              <Text style={styles.heroTitle}>{data.name}</Text>
              <Text style={styles.heroHours}>{data.hours}</Text>
            </View>

            <Pressable testID="btn-whatsapp" onPress={openWhatsApp} style={[styles.actionCard, { backgroundColor: "#25D366" }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>WhatsApp</Text>
                <Text style={styles.actionSub}>{data.whatsapp}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </Pressable>

            <Pressable testID="btn-call" onPress={openCall} style={styles.row}>
              <View style={styles.rowIcon}><Ionicons name="call-outline" size={20} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Telefone</Text>
                <Text style={styles.rowSub}>{data.phone}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>

            <Pressable testID="btn-email" onPress={openEmail} style={styles.row}>
              <View style={styles.rowIcon}><Ionicons name="mail-outline" size={20} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>E-mail</Text>
                <Text style={styles.rowSub}>{data.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>

            <Pressable testID="btn-map" onPress={openMap} style={styles.row}>
              <View style={styles.rowIcon}><Ionicons name="location-outline" size={20} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Endereço</Text>
                <Text style={styles.rowSub}>{data.address}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors: ThemeColors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  heroCard: { backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.xl, gap: 6 },
  heroTitle: { color: colors.onBrandPrimary, fontSize: 20, fontWeight: "800", marginTop: 6 },
  heroHours: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.lg,
  },
  actionTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  actionSub: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
  },
  rowIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
}));
