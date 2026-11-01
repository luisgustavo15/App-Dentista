import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Dentist, type Service } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

function buildDates(n = 14) {
  const out: { key: string; label: string; weekday: string }[] = [];
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      key,
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      weekday: days[d.getDay()],
    });
  }
  return out;
}

export default function BookingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ serviceId?: string }>();

  const [serviceId, setServiceId] = useState<string | null>(params.serviceId ?? null);
  const [dentistId, setDentistId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(() => buildDates(14), []);
  const services = useQuery({ queryKey: ["services"], queryFn: () => api.get<Service[]>("/services") });
  const dentists = useQuery({ queryKey: ["dentists"], queryFn: () => api.get<Dentist[]>("/dentists") });

  const slots = useQuery({
    queryKey: ["slots", dentistId, date],
    queryFn: () => api.get<{ slots: string[] }>(`/appointments/available-slots?date=${date}&dentist_id=${dentistId}`),
    enabled: !!dentistId && !!date,
  });

  const service = services.data?.find((s) => s.id === serviceId);
  const dentist = dentists.data?.find((d) => d.id === dentistId);
  const canConfirm = !!serviceId && !!dentistId && !!date && !!time && !submitting;

  const onConfirm = async () => {
    if (!canConfirm) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/appointments", {
        service_id: serviceId,
        dentist_id: dentistId,
        date,
        time,
        notes,
      });
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      qc.invalidateQueries({ queryKey: ["admin-appointments"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      router.replace({ pathname: "/booking/success", params: { date: date!, time: time!, service: service?.name ?? "" } });
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível agendar. Tente novamente.");
      qc.invalidateQueries({ queryKey: ["slots", dentistId, date] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root} testID="booking-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Agendar Consulta</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.xl }}>
        <View>
          <Text style={styles.stepLabel}>1. Escolha o serviço</Text>
          <View style={styles.optionGrid}>
            {(services.data ?? []).map((s) => {
              const active = s.id === serviceId;
              return (
                <Pressable
                  key={s.id}
                  testID={`service-opt-${s.id}`}
                  onPress={() => setServiceId(s.id)}
                  style={[styles.optionCard, active && styles.optionActive]}
                >
                  <View style={[styles.optionIcon, active && { backgroundColor: colors.onBrandPrimary }]}>
                    <Ionicons name={s.icon as any} size={20} color={active ? colors.brandPrimary : colors.brandPrimary} />
                  </View>
                  <Text style={[styles.optionTitle, active && { color: colors.onBrandPrimary }]} numberOfLines={2}>{s.name}</Text>
                  <Text style={[styles.optionMeta, active && { color: colors.onBrandPrimary }]}>{s.duration_min} min • R$ {s.price.toFixed(0)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={styles.stepLabel}>2. Escolha o dentista</Text>
          <View style={{ gap: spacing.sm }}>
            {(dentists.data ?? []).map((d) => {
              const active = d.id === dentistId;
              return (
                <Pressable
                  key={d.id}
                  testID={`dentist-opt-${d.id}`}
                  onPress={() => { setDentistId(d.id); setTime(null); }}
                  style={[styles.dentistRow, active && styles.dentistActive]}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dentistName}>{d.name}</Text>
                    <Text style={styles.dentistSpec}>{d.specialty}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={styles.stepLabel}>3. Escolha a data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: spacing.lg }}>
            {dates.map((d) => {
              const active = d.key === date;
              return (
                <Pressable
                  key={d.key}
                  testID={`date-${d.key}`}
                  onPress={() => { setDate(d.key); setTime(null); }}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                >
                  <Text style={[styles.dateWeekday, active && { color: colors.onBrandPrimary }]}>{d.weekday}</Text>
                  <Text style={[styles.dateLabel, active && { color: colors.onBrandPrimary }]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View>
          <Text style={styles.stepLabel}>4. Escolha o horário</Text>
          {!dentistId || !date ? (
            <Text style={styles.hint}>Selecione o dentista e a data primeiro.</Text>
          ) : slots.isFetching ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (slots.data?.slots ?? []).length === 0 ? (
            <Text style={styles.hint}>Nenhum horário disponível neste dia.</Text>
          ) : (
            <View style={styles.timeGrid}>
              {(slots.data?.slots ?? []).map((t) => {
                const active = t === time;
                return (
                  <Pressable
                    key={t}
                    testID={`time-${t}`}
                    onPress={() => setTime(t)}
                    style={[styles.timeChip, active && styles.timeChipActive]}
                  >
                    <Text style={[styles.timeText, active && { color: colors.onBrandPrimary }]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View>
          <Text style={styles.stepLabel}>Observações (opcional)</Text>
          <TextInput
            testID="notes-input"
            value={notes}
            onChangeText={setNotes}
            placeholder="Alguma preocupação ou pedido especial?"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.notes}
          />
        </View>

        {service && dentist && date && time && (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Resumo</Text>
            <Text style={styles.summaryItem}>{service.name}</Text>
            <Text style={styles.summaryMeta}>{dentist.name} • {date.split("-").reverse().join("/")} às {time}</Text>
            <Text style={styles.summaryPrice}>R$ {service.price.toFixed(2)}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {error && (
          <Text testID="booking-error" style={styles.errorText}>{error}</Text>
        )}
        <Pressable
          testID="confirm-booking-btn"
          disabled={!canConfirm}
          onPress={onConfirm}
          style={[styles.confirmBtn, !canConfirm && { opacity: 0.5 }]}
        >
          {submitting ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
            <Text style={styles.confirmText}>Confirmar Agendamento</Text>
          )}
        </Pressable>
      </View>
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
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },

  stepLabel: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.sm },

  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  optionCard: {
    width: "48%", padding: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg, gap: 6,
  },
  optionActive: { backgroundColor: colors.brandPrimary },
  optionIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center",
  },
  optionTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurface, marginTop: 4 },
  optionMeta: { fontSize: 11, color: colors.muted },

  dentistRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary,
    borderWidth: 2, borderColor: "transparent",
  },
  dentistActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandSecondary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.brandPrimary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  dentistName: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  dentistSpec: { fontSize: 12, color: colors.muted },

  dateChip: {
    paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, alignItems: "center", minWidth: 70, flexShrink: 0,
  },
  dateChipActive: { backgroundColor: colors.brandPrimary },
  dateWeekday: { fontSize: 11, fontWeight: "600", color: colors.muted },
  dateLabel: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginTop: 2 },

  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  timeChipActive: { backgroundColor: colors.brandPrimary },
  timeText: { fontSize: 13, fontWeight: "700", color: colors.onSurface },

  hint: { color: colors.muted, fontSize: 13, padding: spacing.md },

  notes: {
    minHeight: 90, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, color: colors.onSurface, textAlignVertical: "top",
  },

  summary: { padding: spacing.lg, backgroundColor: colors.brandSecondary, borderRadius: radius.lg, gap: 4 },
  summaryTitle: { fontSize: 13, fontWeight: "700", color: colors.brandPrimary, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryItem: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  summaryMeta: { fontSize: 13, color: colors.onSurfaceSecondary },
  summaryPrice: { fontSize: 20, fontWeight: "800", color: colors.brandPrimary, marginTop: 4 },

  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.md,
    alignItems: "center", minHeight: 52, justifyContent: "center",
  },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "600", marginBottom: spacing.sm, textAlign: "center" },
  confirmText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
});
