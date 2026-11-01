import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type GalleryItem } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data = [] } = useQuery({ queryKey: ["gallery"], queryFn: () => api.get<GalleryItem[]>("/gallery") });

  return (
    <View style={styles.root} testID="gallery-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Antes e Depois</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing["3xl"] }}>
        {data.map((g) => (
          <View key={g.id} style={styles.card} testID={`gallery-${g.id}`}>
            <View style={styles.imgRow}>
              <View style={styles.imgCol}>
                <Image source={g.before_image} style={styles.img} contentFit="cover" />
                <View style={styles.tag}><Text style={styles.tagText}>Antes</Text></View>
              </View>
              <View style={styles.imgCol}>
                <Image source={g.after_image} style={styles.img} contentFit="cover" />
                <View style={[styles.tag, { backgroundColor: colors.success }]}><Text style={styles.tagText}>Depois</Text></View>
              </View>
            </View>
            <View style={styles.body}>
              <Text style={styles.caseTitle}>{g.title}</Text>
              <Text style={styles.service}>{g.service_name}</Text>
              <Text style={styles.desc}>{g.description}</Text>
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
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden" },
  imgRow: { flexDirection: "row", gap: 2 },
  imgCol: { flex: 1, position: "relative" },
  img: { width: "100%", height: 180 },
  tag: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: colors.onSurface, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill,
  },
  tagText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  body: { padding: spacing.lg, gap: 4 },
  caseTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  service: { fontSize: 12, color: colors.brandPrimary, fontWeight: "700" },
  desc: { fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 4, lineHeight: 19 },
});
