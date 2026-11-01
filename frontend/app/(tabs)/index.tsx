import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Appointment, type Dentist, type Service } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1000&q=80";

function formatDate(date: string, time: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y} • ${time}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const services = useQuery({ queryKey: ["services"], queryFn: () => api.get<Service[]>("/services") });
  const dentists = useQuery({ queryKey: ["dentists"], queryFn: () => api.get<Dentist[]>("/dentists") });
  const appts = useQuery({ queryKey: ["my-appointments"], queryFn: () => api.get<Appointment[]>("/appointments/mine") });

  const refreshing = services.isFetching || appts.isFetching;
  const upcoming = (appts.data ?? []).filter(
    (a) => a.status !== "cancelled" && a.status !== "completed",
  ).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];

  const onRefresh = () => {
    services.refetch();
    dentists.refetch();
    appts.refetch();
  };

  return (
    <View style={styles.root} testID="home-screen">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["rgba(26,115,232,0.3)", "rgba(23,78,166,0.95)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroContent}>
            <Text style={styles.greeting}>Olá, {user?.name?.split(" ")[0] ?? "paciente"} 👋</Text>
            <Text style={styles.heroTitle}>Pronto para cuidar do seu sorriso?</Text>

            <Pressable
              testID="hero-book-button"
              onPress={() => router.push("/booking")}
              style={({ pressed }) => [styles.heroCTA, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="add-circle" size={20} color={colors.brandPrimary} />
              <Text style={styles.heroCTAText}>Agendar consulta</Text>
            </Pressable>
          </View>
        </View>

        {/* Next appointment card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Próxima consulta</Text>
          {upcoming ? (
            <Pressable
              testID="next-appointment-card"
              onPress={() => router.push("/(tabs)/appointments")}
              style={styles.nextApptCard}
            >
              <View style={styles.apptIcon}>
                <Ionicons name="calendar" size={24} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.apptService}>{upcoming.service_name}</Text>
                <Text style={styles.apptMeta}>{formatDate(upcoming.date, upcoming.time)}</Text>
                <Text style={styles.apptMeta}>{upcoming.dentist_name}</Text>
              </View>
              <View style={[styles.statusPill, statusStyles[upcoming.status]]}>
                <Text style={[styles.statusText, statusStyles[upcoming.status]]}>
                  {statusLabel[upcoming.status]}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={28} color={colors.muted} />
              <Text style={styles.emptyText}>Nenhuma consulta agendada</Text>
              <Pressable
                testID="empty-book-button"
                onPress={() => router.push("/booking")}
                style={styles.emptyCTA}
              >
                <Text style={styles.emptyCTAText}>Agendar agora</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acesso rápido</Text>
          <View style={styles.quickRow}>
            <QuickAction icon="medkit-outline" label="Serviços" onPress={() => router.push("/services")} testID="qa-services" />
            <QuickAction icon="people-outline" label="Equipe" onPress={() => router.push("/team")} testID="qa-team" />
            <QuickAction icon="images-outline" label="Galeria" onPress={() => router.push("/gallery")} testID="qa-gallery" />
            <QuickAction icon="call-outline" label="Contato" onPress={() => router.push("/contact")} testID="qa-contact" />
          </View>
        </View>

        {/* Services preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nossos serviços</Text>
            <Pressable onPress={() => router.push("/services")}>
              <Text style={styles.linkText}>Ver todos</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {(services.data ?? []).slice(0, 6).map((s) => (
              <Pressable
                key={s.id}
                testID={`service-tile-${s.id}`}
                onPress={() => router.push({ pathname: "/booking", params: { serviceId: s.id } })}
                style={styles.serviceTile}
              >
                <View style={styles.serviceIcon}>
                  <Ionicons name={s.icon as any} size={24} color={colors.brandPrimary} />
                </View>
                <Text style={styles.serviceName} numberOfLines={2}>{s.name}</Text>
                <Text style={styles.servicePrice}>R$ {s.price.toFixed(0)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Featured dentist */}
        {dentists.data?.[0] && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conheça o Dr. Jocélio</Text>
            <Pressable
              testID="featured-dentist"
              onPress={() => router.push("/team")}
              style={styles.dentistCard}
            >
              <Image source={dentists.data[0].photo} style={styles.dentistPhoto} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.dentistName}>{dentists.data[0].name}</Text>
                <Text style={styles.dentistSpecialty}>{dentists.data[0].specialty}</Text>
                <Text style={styles.dentistBio} numberOfLines={3}>{dentists.data[0].bio}</Text>
              </View>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.qa}>
      <View style={styles.qaIcon}>
        <Ionicons name={icon} size={22} color={colors.brandPrimary} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </Pressable>
  );
}

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Concluída",
};

const statusStyles: Record<string, any> = {
  pending: { backgroundColor: "#FEF3C7", color: "#92400E" },
  confirmed: { backgroundColor: "#D1FAE5", color: "#065F46" },
  cancelled: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  completed: { backgroundColor: "#E0E7FF", color: "#3730A3" },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: {
    height: 240,
    overflow: "hidden",
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  heroContent: { flex: 1, padding: spacing.xl, justifyContent: "flex-end" },
  greeting: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500" },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginTop: 6, marginBottom: spacing.md },
  heroCTA: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  heroCTAText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 14 },

  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl, gap: spacing.md },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  linkText: { color: colors.brandPrimary, fontWeight: "600", fontSize: 14 },

  nextApptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  apptIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center",
  },
  apptService: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  apptMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: "700" },

  emptyCard: {
    backgroundColor: colors.surfaceSecondary, padding: spacing.xl, borderRadius: radius.lg,
    alignItems: "center", gap: spacing.sm,
  },
  emptyText: { color: colors.muted, fontSize: 14 },
  emptyCTA: { backgroundColor: colors.brandPrimary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.pill, marginTop: 4 },
  emptyCTAText: { color: colors.onBrandPrimary, fontWeight: "700" },

  quickRow: { flexDirection: "row", gap: spacing.md },
  qa: { flex: 1, alignItems: "center", gap: 6 },
  qaIcon: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center",
  },
  qaLabel: { fontSize: 12, fontWeight: "600", color: colors.onSurface },

  hScroll: { gap: spacing.md, paddingRight: spacing.lg },
  serviceTile: {
    width: 140, padding: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg, gap: 6,
  },
  serviceIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center",
  },
  serviceName: { fontSize: 13, fontWeight: "700", color: colors.onSurface, marginTop: 4 },
  servicePrice: { fontSize: 12, color: colors.brandPrimary, fontWeight: "700" },

  dentistCard: {
    flexDirection: "row", gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
  },
  dentistPhoto: { width: 80, height: 80, borderRadius: radius.md },
  dentistName: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  dentistSpecialty: { fontSize: 12, color: colors.brandPrimary, fontWeight: "600", marginTop: 2 },
  dentistBio: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
});
