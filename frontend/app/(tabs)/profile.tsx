import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={styles.root} testID="profile-screen">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {user?.picture ? (
            <Image source={user.picture} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.role === "admin" && (
            <View style={styles.rolePill}>
              <Ionicons name="shield-checkmark" size={12} color={colors.onBrandPrimary} />
              <Text style={styles.roleText}>Administrador</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clínica</Text>
          <MenuRow icon="medkit-outline" label="Serviços" testID="row-services" onPress={() => router.push("/services")} />
          <MenuRow icon="people-outline" label="Nossa equipe" testID="row-team" onPress={() => router.push("/team")} />
          <MenuRow icon="images-outline" label="Galeria Antes/Depois" testID="row-gallery" onPress={() => router.push("/gallery")} />
          <MenuRow icon="call-outline" label="Contato e localização" testID="row-contact" onPress={() => router.push("/contact")} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>
          <MenuRow icon="log-out-outline" label="Sair" destructive testID="row-logout" onPress={logout} />
        </View>

        <Text style={styles.version}>v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function MenuRow({ icon, label, onPress, destructive, testID }: { icon: any; label: string; onPress: () => void; destructive?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSecondary }]}
    >
      <View style={[styles.rowIcon, destructive && { backgroundColor: "#FEE2E2" }]}>
        <Ionicons name={icon} size={18} color={destructive ? colors.error : colors.brandPrimary} />
      </View>
      <Text style={[styles.rowLabel, destructive && { color: colors.error }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { alignItems: "center", padding: spacing.xl, gap: 6 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.surfaceSecondary },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSecondary },
  initials: { fontSize: 32, fontWeight: "800", color: colors.brandPrimary },
  name: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm },
  email: { fontSize: 14, color: colors.muted },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 6, paddingVertical: 4, paddingHorizontal: 10,
    backgroundColor: colors.brandPrimary, borderRadius: radius.pill,
  },
  roleText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "700" },

  section: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, gap: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },

  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.onSurface },

  version: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: spacing.xl },
});
