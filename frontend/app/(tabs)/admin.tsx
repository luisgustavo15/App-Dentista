import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Appointment } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

type Stats = {
  total_appointments: number;
  today_appointments: number;
  pending: number;
  confirmed: number;
  patients: number;
};

const FILTERS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendentes" },
  { key: "confirmed", label: "Confirmadas" },
  { key: "completed", label: "Concluídas" },
  { key: "cancelled", label: "Canceladas" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

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

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => api.get<Stats>("/admin/stats") });
  const appts = useQuery({
    queryKey: ["admin-appointments"],
    queryFn: () => api.get<Appointment[]>("/admin/appointments"),
  });

  const update = async (id: string, status: string) => {
    try {
      await api.put(`/admin/appointments/${id}`, { status });
      qc.invalidateQueries({ queryKey: ["admin-appointments"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Falha ao atualizar");
    }
  };

  const filtered = (appts.data ?? []).filter((a) => (filter === "all" ? true : a.status === filter));
  const refreshing = stats.isFetching || appts.isFetching;

  return (
    <View style={styles.root} testID="admin-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Painel Admin</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              stats.refetch();
              appts.refetch();
            }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="Hoje" value={stats.data?.today_appointments ?? 0} icon="today-outline" />
          <StatCard label="Pendentes" value={stats.data?.pending ?? 0} icon="hourglass-outline" />
          <StatCard label="Confirmadas" value={stats.data?.confirmed ?? 0} icon="checkmark-circle-outline" />
          <StatCard label="Pacientes" value={stats.data?.patients ?? 0} icon="people-outline" />
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>Nenhum agendamento</Text>
          </View>
        ) : (
          filtered.map((a) => {
            const sc = statusColors[a.status];
            return (
              <View key={a.id} style={styles.card} testID={`admin-appt-${a.id}`}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patient}>{a.patient_name}</Text>
                    <Text style={styles.patientEmail}>{a.patient_email}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.pillText, { color: sc.fg }]}>{statusLabel[a.status]}</Text>
                  </View>
                </View>
                <View style={styles.row}><Ionicons name="briefcase-outline" size={14} color={colors.muted} /><Text style={styles.rowText}>{a.service_name}</Text></View>
                <View style={styles.row}><Ionicons name="person-outline" size={14} color={colors.muted} /><Text style={styles.rowText}>{a.dentist_name}</Text></View>
                <View style={styles.row}><Ionicons name="calendar-outline" size={14} color={colors.muted} /><Text style={styles.rowText}>{a.date.split("-").reverse().join("/")} às {a.time}</Text></View>
                {!!a.notes && <View style={styles.row}><Ionicons name="document-text-outline" size={14} color={colors.muted} /><Text style={styles.rowText}>{a.notes}</Text></View>}

                <View style={styles.actions}>
                  {a.status !== "confirmed" && a.status !== "cancelled" && (
                    <Pressable testID={`confirm-${a.id}`} onPress={() => update(a.id, "confirmed")} style={[styles.actionBtn, { backgroundColor: colors.success }]}>
                      <Text style={styles.actionText}>Confirmar</Text>
                    </Pressable>
                  )}
                  {a.status !== "completed" && a.status !== "cancelled" && (
                    <Pressable testID={`complete-${a.id}`} onPress={() => update(a.id, "completed")} style={[styles.actionBtn, { backgroundColor: colors.brandPrimary }]}>
                      <Text style={styles.actionText}>Concluir</Text>
                    </Pressable>
                  )}
                  {a.status !== "cancelled" && (
                    <Pressable testID={`admin-cancel-${a.id}`} onPress={() => update(a.id, "cancelled")} style={[styles.actionBtn, { backgroundColor: colors.error }]}>
                      <Text style={styles.actionText}>Cancelar</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: any }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}><Ionicons name={icon} size={18} color={colors.brandPrimary} /></View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  chipRow: { gap: 8, paddingVertical: 4, paddingRight: spacing.lg },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: colors.onBrandPrimary },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: {
    flex: 1, minWidth: "47%", padding: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg, gap: 4,
  },
  statIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center",
  },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.onSurface, marginTop: 4 },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },

  empty: { alignItems: "center", gap: spacing.md, padding: spacing["2xl"] },
  emptyText: { color: colors.muted },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  patient: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  patientEmail: { fontSize: 12, color: colors.muted },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: "700" },

  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowText: { color: colors.onSurfaceSecondary, fontSize: 13, flex: 1 },

  actions: { flexDirection: "row", gap: 6, marginTop: spacing.sm, flexWrap: "wrap" },
  actionBtn: { flex: 1, minWidth: 80, paddingVertical: 8, borderRadius: radius.md, alignItems: "center" },
  actionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
});
