import Ionicons from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";

import { useAuth } from "@/src/auth/AuthContext";
import { colors } from "@/src/theme";

export default function TabsLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Consultas",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: isAdmin ? "/(tabs)/admin" : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "600" },
});
