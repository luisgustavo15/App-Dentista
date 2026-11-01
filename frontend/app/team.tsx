import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Dentist } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data = [] } = useQuery({ queryKey: ["dentists"], queryFn: () => api.get<Dentist[]>("/dentists") });

  return (
    <View style={styles.root} testID="team-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Nossa Equipe</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}>
        {data.map((d) => (
          <View key={d.id} style={styles.card} testID={`dentist-${d.id}`}>
            <Image source={d.photo} style={styles.photo} contentFit="cover" />
            <View style={styles.body}>
              <Text style={styles.name}>{d.name}</Text>
              <Text style={styles.specialty}>{d.specialty}</Text>
              <Text style={styles.cro}>{d.cro}</Text>
              <Text style={styles.bio}>{d.bio}</Text>
            </View>
          </View>
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
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden",
  },
  photo: { width: "100%", height: 220 },
  body: { padding: spacing.lg, gap: 4 },
  name: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  specialty: { fontSize: 13, color: colors.brandPrimary, fontWeight: "700" },
  cro: { fontSize: 12, color: colors.muted },
  bio: { fontSize: 13, color: colors.onSurfaceSecondary, marginTop: spacing.sm, lineHeight: 19 },
});
