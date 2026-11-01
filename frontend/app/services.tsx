import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Service } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data = [] } = useQuery({ queryKey: ["services"], queryFn: () => api.get<Service[]>("/services") });

  return (
    <View style={styles.root} testID="services-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Nossos Serviços</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}>
        {data.map((s) => (
          <Pressable
            key={s.id}
            testID={`service-${s.id}`}
            onPress={() => router.push({ pathname: "/booking", params: { serviceId: s.id } })}
            style={styles.card}
          >
            <View style={styles.icon}>
              <Ionicons name={s.icon as any} size={26} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.desc} numberOfLines={2}>{s.description}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={13} color={colors.muted} />
                  <Text style={styles.metaText}>{s.duration_min} min</Text>
                </View>
                <Text style={styles.price}>R$ {s.price.toFixed(0)}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  card: {
    flexDirection: "row", gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
  },
  icon: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  desc: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.muted },
  price: { fontSize: 15, fontWeight: "800", color: colors.brandPrimary },
});
