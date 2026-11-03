import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Appointment } from "@/src/api/client";
import { radius, spacing, makeStyles, useTheme, type ThemeColors } from "@/src/theme";

const TABS = [
  { key: "upcoming", label: "Próximas" },
  { key: "history", label: "Histórico" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Concluída",
};

const statusColors: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#FEF3C7", fg: "#92400E" },
  confirmed: { bg: "#D1FAE5", fg: "#065F46" },
  cancelled: { bg: "#FEE2E2", fg: "#991B1B" },
  completed: { bg: "#E0E7FF", fg: "#3730A3" },
};

export default function AppointmentsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("upcoming");

  const { data = [], isFetching, refetch } = useQuery({
    queryKey: ["my-appointments"],
    queryFn: () => api.get<Appointment[]>("/appointments/mine"),
  });

  const filtered = data.filter((a) =>
    tab === "upcoming"
      ? a.status === "pending" || a.status === "confirmed"
      : a.status === "cancelled" || a.status === "completed",
  );

  const onCancel = async (id: string) => {
    const doCancel = async () => {
      try {
        await api.del(`/appointments/${id}`);
        qc.invalidateQueries({ queryKey: ["my-appointments"] });
      } catch (e: any) {
        Alert.alert("Erro", e?.message ?? "Falha ao cancelar");
      }
    };
    Alert.alert("Cancelar consulta?", "Esta ação não pode ser desfeita.", [
      { text: "Voltar", style: "cancel" },
      { text: "Cancelar consulta", style: "destructive", onPress: doCancel },
    ]);
  };

  return (
    <View style={styles.root} testID="appointments-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Minhas Consultas</Text>
        <View style={styles.segment}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Pressable
                key={t.key}
                testID={`seg-${t.key}`}
                onPress={() => setTab(t.key)}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => { refetch(); }} tintColor={colors.brandPrimary} />}
      >
        {isFetching && data.length === 0 ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>
              {tab === "upcoming" ? "Nenhuma consulta agendada" : "Nenhum histórico ainda"}
            </Text>
            {tab === "upcoming" && (
              <Pressable testID="empty-book-btn" onPress={() => router.push("/booking")} style={styles.cta}>
                <Text style={styles.ctaText}>Agendar consulta</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filtered.map((a) => {
            const sc = statusColors[a.status];
            return (
              <View key={a.id} style={styles.card} testID={`appt-${a.id}`}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardService}>{a.service_name}</Text>
                  <View style={[styles.pill, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.pillText, { color: sc.fg }]}>{statusLabel[a.status]}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <Ionicons name="calendar-outline" size={16} color={colors.muted} />
                  <Text style={styles.rowText}>
                    {a.date.split("-").reverse().join("/")} às {a.time}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="person-outline" size={16} color={colors.muted} />
                  <Text style={styles.rowText}>{a.dentist_name}</Text>
                </View>
                {!!a.notes && (
                  <View style={styles.row}>
                    <Ionicons name="document-text-outline" size={16} color={colors.muted} />
                    <Text style={styles.rowText} numberOfLines={2}>{a.notes}</Text>
                  </View>
                )}
                {(a.status === "pending" || a.status === "confirmed") && (
                  <Pressable
                    testID={`cancel-${a.id}`}
                    onPress={() => onCancel(a.id)}
                    style={styles.cancelBtn}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={colors.error} />
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors: ThemeColors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    padding: 4,
  },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center" },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segmentTextActive: { color: colors.onBrandPrimary },

  empty: { alignItems: "center", gap: spacing.md, padding: spacing["2xl"], marginTop: spacing.xl },
  emptyText: { color: colors.muted, fontSize: 14 },
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.pill },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700" },

  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardService: { fontSize: 16, fontWeight: "800", color: colors.onSurface, flex: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowText: { color: colors.onSurfaceSecondary, fontSize: 13, flex: 1 },

  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.error, marginTop: spacing.xs,
  },
  cancelText: { color: colors.error, fontWeight: "700", fontSize: 13 },
}));
