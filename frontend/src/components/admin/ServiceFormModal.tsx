import Ionicons from "@react-native-vector-icons/ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Service } from "@/src/api/client";
import { makeStyles, radius, spacing, useTheme, type ThemeColors } from "@/src/theme";
import { parseBRL } from "@/src/utils/format";

const ICONS = [
  "medkit-outline", "sparkles-outline", "sunny-outline", "pulse-outline", "color-wand-outline",
  "construct-outline", "happy-outline", "git-branch-outline", "shield-checkmark-outline", "heart-outline",
] as const;

type Props = { visible: boolean; service: Service | null; onClose: () => void };

export function ServiceFormModal({ visible, service, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState<string>(ICONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setDuration(service ? String(service.duration_min) : "");
    setPrice(service ? service.price.toFixed(2).replace(".", ",") : "");
    setIcon(service?.icon ?? ICONS[0]);
    setError(null);
  }, [visible, service]);

  const save = async () => {
    const priceNum = parseBRL(price);
    const durationNum = Number(duration);
    if (name.trim().length < 2) return setError("Digite o nome do procedimento");
    if (!Number.isInteger(durationNum) || durationNum < 5) return setError("Duração em minutos (mínimo 5)");
    if (Number.isNaN(priceNum) || priceNum < 0) return setError("Digite um valor válido");
    setSaving(true);
    setError(null);
    const body = { name: name.trim(), description: description.trim(), duration_min: durationNum, price: priceNum, icon };
    try {
      if (service) await api.put(`/admin/services/${service.id}`, body);
      else await api.post("/admin/services", body);
      qc.invalidateQueries({ queryKey: ["admin-services"] });
      qc.invalidateQueries({ queryKey: ["services"] });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} testID="service-form-backdrop" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="service-form">
          <View style={styles.sheetHeader}>
            <Text style={styles.title}>{service ? "Editar procedimento" : "Novo procedimento"}</Text>
            <Pressable testID="service-form-close" onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Label text="Nome" />
            <TextInput testID="service-name-input" value={name} onChangeText={setName} placeholder="Ex.: Lente de contato dental" placeholderTextColor={colors.muted} style={styles.input} />
            <Label text="Descrição" />
            <TextInput testID="service-desc-input" value={description} onChangeText={setDescription} placeholder="O que o paciente deve saber" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline]} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Label text="Duração (min)" />
                <TextInput testID="service-duration-input" value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="60" placeholderTextColor={colors.muted} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="Valor (R$)" />
                <TextInput testID="service-price-input" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="250,00" placeholderTextColor={colors.muted} style={styles.input} />
              </View>
            </View>
            <Label text="Ícone" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
              {ICONS.map((i) => {
                const on = i === icon;
                return (
                  <Pressable key={i} testID={`service-icon-${i}`} onPress={() => setIcon(i)} style={[styles.iconChip, on && styles.iconChipActive]}>
                    <Ionicons name={i} size={20} color={on ? colors.onBrandPrimary : colors.brandPrimary} />
                  </Pressable>
                );
              })}
            </ScrollView>
            {error && <Text testID="service-form-error" style={styles.error}>{error}</Text>}
            <Pressable testID="service-form-save" onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.7 }]}>
              {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveText}>{service ? "Salvar alterações" : "Adicionar procedimento"}</Text>}
            </Pressable>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Label({ text }: { text: string }) {
  const styles = useStyles();
  return <Text style={styles.label}>{text}</Text>;
}

const useStyles = makeStyles((colors: ThemeColors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "88%", backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.lg,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  closeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  form: { padding: spacing.lg, gap: spacing.sm },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 48,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: spacing.md },
  iconRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  iconChip: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  iconChipActive: { backgroundColor: colors.brandPrimary },
  error: { color: colors.error, fontSize: 13, fontWeight: "600" },
  saveBtn: {
    marginTop: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md, minHeight: 52,
    alignItems: "center", justifyContent: "center",
  },
  saveText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "800" },
}));
