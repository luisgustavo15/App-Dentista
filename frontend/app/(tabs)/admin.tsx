import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgendaSection } from "@/src/components/admin/AgendaSection";
import { FinanceSection } from "@/src/components/admin/FinanceSection";
import { ServicesSection } from "@/src/components/admin/ServicesSection";
import { radius, spacing, makeStyles, type ThemeColors } from "@/src/theme";

const SECTIONS = [
  { key: "agenda", label: "Agenda" },
  { key: "finance", label: "Financeiro" },
  { key: "services", label: "Procedimentos" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export default function AdminScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<SectionKey>("agenda");

  return (
    <View style={styles.root} testID="admin-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Painel Admin</Text>
        <View style={styles.segment}>
          {SECTIONS.map((s) => {
            const on = s.key === section;
            return (
              <Pressable
                key={s.key}
                testID={`admin-tab-${s.key}`}
                onPress={() => setSection(s.key)}
                style={[styles.segmentItem, on && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {section === "agenda" && <AgendaSection />}
      {section === "finance" && <FinanceSection />}
      {section === "services" && <ServicesSection />}
    </View>
  );
}

const useStyles = makeStyles((colors: ThemeColors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, backgroundColor: colors.surface },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, minHeight: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  segmentTextActive: { color: colors.onBrandPrimary },
}));
