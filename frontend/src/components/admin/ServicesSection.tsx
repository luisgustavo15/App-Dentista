import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { api, type Service } from "@/src/api/client";
import { ServiceFormModal } from "@/src/components/admin/ServiceFormModal";
import { makeStyles, radius, spacing, useTheme, type ThemeColors } from "@/src/theme";
import { formatBRL } from "@/src/utils/format";

export function ServicesSection() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Service | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data = [], isFetching, isLoading, refetch } = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => api.get<Service[]>("/admin/services"),
  });
  const active = data.filter((s) => s.active !== false);
  const removed = data.filter((s) => s.active === false);

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["admin-services"] });
      qc.invalidateQueries({ queryKey: ["services"] });
    } catch (e: any) {
      setError(e?.message ?? "Falha na operação");
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const openForm = (s: Service | null) => {
    setEditing(s);
    setFormOpen(true);
  };

  return (
    <View style={styles.root} testID="admin-services">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => { refetch(); }} tintColor={colors.brandPrimary} />}
      >
        <Pressable testID="add-service-btn" onPress={() => openForm(null)} style={styles.addBtn}>
          <Ionicons name="add-circle" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.addText}>Novo procedimento</Text>
        </Pressable>

        {error && <Text testID="services-error" style={styles.error}>{error}</Text>}

        <Text style={styles.sectionTitle}>Ofertados ({active.length})</Text>
        {isLoading && <ActivityIndicator color={colors.brandPrimary} />}
        {active.map((s) => (
          <View key={s.id} style={styles.card} testID={`admin-service-${s.id}`}>
            <View style={styles.cardTop}>
              <View style={styles.icon}>
                <Ionicons name={s.icon as any} size={20} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.meta}>{s.duration_min} min • {formatBRL(s.price)}</Text>
              </View>
            </View>
            {confirmId === s.id ? (
              <View style={styles.actions}>
                <Text style={styles.confirmText}>Remover da lista de serviços?</Text>
                <Pressable testID={`remove-cancel-${s.id}`} onPress={() => setConfirmId(null)} style={[styles.smallBtn, styles.ghostBtn]}>
                  <Text style={styles.ghostText}>Não</Text>
                </Pressable>
                <Pressable testID={`remove-confirm-${s.id}`} onPress={() => run(s.id, () => api.del(`/admin/services/${s.id}`))} style={[styles.smallBtn, { backgroundColor: colors.error }]}>
                  {busyId === s.id ? <ActivityIndicator size="small" color={colors.onError} /> : <Text style={[styles.smallText, { color: colors.onError }]}>Remover</Text>}
                </Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable testID={`edit-service-${s.id}`} onPress={() => openForm(s)} style={[styles.smallBtn, styles.ghostBtn, { flex: 1 }]}>
                  <Ionicons name="create-outline" size={16} color={colors.brandPrimary} />
                  <Text style={[styles.ghostText, { color: colors.brandPrimary }]}>Editar</Text>
                </Pressable>
                <Pressable testID={`remove-service-${s.id}`} onPress={() => setConfirmId(s.id)} style={[styles.smallBtn, styles.ghostBtn, { flex: 1 }]}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={[styles.ghostText, { color: colors.error }]}>Remover</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}

        {removed.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Não ofertados ({removed.length})</Text>
            <Text style={styles.muted}>Pacientes não veem estes procedimentos. O histórico financeiro é mantido.</Text>
            {removed.map((s) => (
              <View key={s.id} style={[styles.card, styles.removedCard]} testID={`removed-service-${s.id}`}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.muted }]}>{s.name}</Text>
                    <Text style={styles.meta}>{formatBRL(s.price)}</Text>
                  </View>
                  <Pressable testID={`restore-service-${s.id}`} onPress={() => run(s.id, () => api.put(`/admin/services/${s.id}`, { active: true }))} style={[styles.smallBtn, styles.ghostBtn]}>
                    {busyId === s.id ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Text style={[styles.ghostText, { color: colors.brandPrimary }]}>Ofertar de novo</Text>}
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <ServiceFormModal visible={formOpen} service={editing} onClose={() => setFormOpen(false)} />
    </View>
  );
}

const useStyles = makeStyles((colors: ThemeColors) => ({
  root: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.brandPrimary, borderRadius: radius.md, minHeight: 52,
  },
  addText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "800" },
  error: { color: colors.error, fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm },
  muted: { fontSize: 12, color: colors.muted },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  removedCard: { opacity: 0.85 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  confirmText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.onSurface },
  smallBtn: {
    flexDirection: "row", gap: 6, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
  },
  smallText: { fontSize: 13, fontWeight: "700" },
  ghostBtn: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  ghostText: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
}));
