import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";

import { api, type Finance, type FinancePeriod, type Service } from "@/src/api/client";
import { makeStyles, radius, spacing, useTheme, type ThemeColors } from "@/src/theme";
import { formatBRL, parseBRL } from "@/src/utils/format";

const PERIODS: { key: FinancePeriod; label: string }[] = [
  { key: "month", label: "Este mês" },
  { key: "last_month", label: "Mês passado" },
  { key: "year", label: "Este ano" },
  { key: "all", label: "Tudo" },
];

export function FinanceSection() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [period, setPeriod] = useState<FinancePeriod>("month");

  const finance = useQuery({
    queryKey: ["admin-finance", period],
    queryFn: () => api.get<Finance>(`/admin/finance?period=${period}`),
  });
  const services = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => api.get<Service[]>("/admin/services"),
  });

  const data = finance.data;
  const maxRevenue = Math.max(1, ...(data?.by_service ?? []).map((r) => r.revenue));
  const active = (services.data ?? []).filter((s) => s.active !== false);

  return (
    <View style={styles.root} testID="admin-finance">
      <View style={styles.chipHeader}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {PERIODS.map((p) => {
            const on = p.key === period;
            return (
              <Pressable
                key={p.key}
                testID={`period-${p.key}`}
                onPress={() => setPeriod(p.key)}
                style={[styles.chip, on && styles.chipActive]}
              >
                <Text style={[styles.chipText, on && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={finance.isFetching || services.isFetching}
            onRefresh={() => {
              finance.refetch();
              services.refetch();
            }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Faturamento com procedimentos concluídos</Text>
          {finance.isLoading ? (
            <ActivityIndicator color={colors.onBrandPrimary} style={{ alignSelf: "flex-start" }} />
          ) : (
            <Text testID="finance-total" style={styles.heroValue}>{formatBRL(data?.total_revenue ?? 0)}</Text>
          )}
        </View>

        <View style={styles.kpiRow}>
          <Kpi label="Realizados" value={String(data?.completed_count ?? 0)} testID="finance-count" />
          <Kpi label="Ticket médio" value={formatBRL(data?.average_ticket ?? 0)} testID="finance-avg" />
        </View>
        <Kpi
          label="Previsto (consultas pendentes e confirmadas)"
          value={formatBRL(data?.expected_revenue ?? 0)}
          testID="finance-expected"
        />

        <Text style={styles.sectionTitle}>Por procedimento</Text>
        {(data?.by_service ?? []).length === 0 ? (
          <Text style={styles.muted}>Nenhum procedimento concluído neste período.</Text>
        ) : (
          data!.by_service.map((r) => (
            <View key={r.service_name} style={styles.breakRow} testID={`finance-row-${r.service_name}`}>
              <View style={styles.breakTop}>
                <Text style={styles.breakName} numberOfLines={1}>{r.service_name}</Text>
                <Text style={styles.breakValue}>{formatBRL(r.revenue)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(r.revenue / maxRevenue) * 100}%` }]} />
              </View>
              <Text style={styles.muted}>{r.count} {r.count === 1 ? "atendimento" : "atendimentos"}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Valores dos procedimentos</Text>
        <Text style={styles.muted}>Novos valores valem para os próximos agendamentos. Consultas já marcadas mantêm o valor original.</Text>
        {active.map((s) => (
          <PriceRow key={s.id} service={s} />
        ))}
      </ScrollView>
    </View>
  );
}

function Kpi({ label, value, testID }: { label: string; value: string; testID: string }) {
  const styles = useStyles();
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text testID={testID} style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function PriceRow({ service }: { service: Service }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [text, setText] = useState(service.price.toFixed(2).replace(".", ","));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const value = parseBRL(text);
  const changed = !Number.isNaN(value) && Math.abs(value - service.price) > 0.001;

  const save = async () => {
    if (Number.isNaN(value) || value < 0) {
      setMsg({ ok: false, text: "Valor inválido" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.put(`/admin/services/${service.id}`, { price: value });
      await qc.invalidateQueries({ queryKey: ["admin-services"] });
      qc.invalidateQueries({ queryKey: ["services"] });
      setMsg({ ok: true, text: "Salvo" });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? "Falha ao salvar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.priceRow} testID={`price-row-${service.id}`}>
      <View style={{ flex: 1 }}>
        <Text style={styles.breakName} numberOfLines={1}>{service.name}</Text>
        {msg && <Text style={[styles.priceMsg, { color: msg.ok ? colors.success : colors.error }]}>{msg.text}</Text>}
      </View>
      <View style={styles.priceInputWrap}>
        <Text style={styles.currency}>R$</Text>
        <TextInput
          testID={`price-input-${service.id}`}
          value={text}
          onChangeText={(t) => {
            setText(t);
            setMsg(null);
          }}
          keyboardType="decimal-pad"
          style={styles.priceInput}
          placeholderTextColor={colors.muted}
        />
      </View>
      <Pressable
        testID={`price-save-${service.id}`}
        onPress={save}
        disabled={!changed || saving}
        style={[styles.saveBtn, (!changed || saving) && { opacity: 0.4 }]}
      >
        {saving ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Ionicons name="checkmark" size={18} color={colors.onBrandPrimary} />}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors: ThemeColors) => ({
  root: { flex: 1 },
  chipHeader: { height: 56, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: colors.onBrandPrimary },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] },
  hero: { backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  heroLabel: { color: colors.onBrandPrimary, opacity: 0.9, fontSize: 13, fontWeight: "600" },
  heroValue: { color: colors.onBrandPrimary, fontSize: 32, fontWeight: "800" },
  kpiRow: { flexDirection: "row", gap: spacing.md },
  kpi: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: 4 },
  kpiLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  kpiValue: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md },
  muted: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  breakRow: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 6 },
  breakTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  breakName: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  breakValue: { fontSize: 14, fontWeight: "800", color: colors.brandPrimary },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.brandSecondary, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary },
  priceRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
  },
  priceMsg: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  priceInputWrap: {
    flexDirection: "row", alignItems: "center", gap: 4, width: 120, height: 44,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  currency: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  priceInput: { flex: 1, fontSize: 15, color: colors.onSurface, fontWeight: "700", paddingVertical: 0 },
  saveBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
