import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { supabase } from "../lib/supabase"; // Import Supabase client
import { useNetInfo } from "@react-native-community/netinfo";

const AccountScreen = () => {
  const netInfo = useNetInfo();
  const isConnected = netInfo.isConnected === true;
  console.log("isConnected:", isConnected);
  const [pendingReadings, setPendingReadings] = useState(0);
  const [totalReadings, setTotalReadings] = useState(0);
  const [completedReadings, setCompletedReadings] = useState(0);
  const [lastSync, setLastSync] = useState("N/A");

  useEffect(() => {
    // Implement connection status check (e.g., using NetInfo)
    fetchData();
  }, []);

  const fetchData = async () => {
    if (isConnected) {
      fetchSupabaseData();
    } else {
      Alert.alert("Offline Mode", "Fetching data from local storage (SQLite)");
    }
  };

  const fetchSupabaseData = async () => {
    try {
      const {
        data: pending,
        error: pendingError,
        count: pendingCount,
      } = await supabase
        .from("readings")
        .select("*", { count: "exact", head: true })
        .eq("is_synced", false);

      if (pendingError) {
        console.error(
          "Error fetching pending readings from Supabase:",
          pendingError.message,
        );
      } else {
        setPendingReadings(pendingCount || 0);
      }

      const {
        data: total,
        error: totalError,
        count: totalCount,
      } = await supabase
        .from("readings")
        .select("*", { count: "exact", head: true });

      if (totalError) {
        console.error(
          "Error fetching total readings from Supabase:",
          totalError.message,
        );
      } else {
        setTotalReadings(totalCount || 0);
      }

      const {
        data: completed,
        error: completedError,
        count: completedCount,
      } = await supabase
        .from("readings")
        .select("*", { count: "exact", head: true })
        .eq("is_synced", true);

      if (completedError) {
        console.error(
          "Error fetching completed readings from Supabase:",
          completedError.message,
        );
      } else {
        setCompletedReadings(completedCount || 0);
      }

      const { data: syncData, error: syncError } = await supabase
        .from("readings")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (syncError) {
        console.error(
          "Error fetching last sync time from Supabase:",
          syncError.message,
        );
      } else if (syncData && syncData.length > 0 && syncData[0].updated_at) {
        const lastUpdateTime = new Date(syncData[0].updated_at);
        setLastSync(
          lastUpdateTime.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } else {
        setLastSync("N/A");
      }
    } catch (error) {
      console.error("Error fetching data from Supabase:", error.message);
      Alert.alert("Erro", "Falha ao buscar dados do servidor.");
    }
  };

  const handleSync = async () => {
    Alert.alert("Sync", "Sincronizando dados...");
    await fetchData();
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Logout Error", error.message);
    } else {
      Alert.alert("Logout", "Saindo da conta...");
    }
  };

  return (
    <View style={styles.appContainer}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Painel Principal</Text>
      </View>

      <View
        style={[
          styles.statusBar,
          isConnected ? styles.statusBarOnline : styles.statusBarOffline,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            isConnected ? styles.statusTextOnline : styles.statusTextOffline,
          ]}
        >
          <Text style={styles.icon}>{isConnected ? "📶" : "❌"}</Text>
          {isConnected ? ` ONLINE | Última Sync: ${lastSync}` : " OFFLINE"}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cameraBtn]}
            onPress={() => Alert.alert("Camera", "Abrindo câmera...")}
          >
            <View style={styles.iconWrapper}>
              <Text style={styles.icon}>📸</Text>
            </View>
            <Text style={styles.buttonText}>Nova Leitura</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.syncBtn]}
            onPress={handleSync}
            disabled={!isConnected}
          >
            <View style={styles.iconWrapper}>
              <Text style={styles.icon}>🔄</Text>
            </View>
            <Text style={styles.buttonText}>Sincronizar</Text>
          </TouchableOpacity>
        </View>

        {pendingReadings > 0 && (
          <View style={styles.notificationBanner}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.icon}>🔔</Text>
              <Text style={styles.text}>
                {pendingReadings} leituras pendentes para sincronizar
              </Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.btn}>Ver</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, styles.welcomeIcon]}>
              <Text style={styles.icon}>👤</Text>
            </View>
            <View>
              <Text style={styles.welcomeTitle}>Olá, Leiturista</Text>
              <Text style={styles.welcomeSubtitle}>
                Bem-vindo ao seu painel de controle.
              </Text>
            </View>
          </View>

          <View style={styles.dateContainer}>
            <Text style={styles.icon}>📅</Text>
            <Text>
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, styles.statsIcon]}>
              <Text style={styles.icon}>📊</Text>
            </View>
            <Text style={styles.statsTitle}>Resumo do Dia</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statsItem, styles.statsTotal]}>
              <Text style={[styles.statsValue, styles.statsValueTotal]}>
                {totalReadings}
              </Text>
              <Text style={[styles.statsLabel, styles.statsLabelTotal]}>
                Total
              </Text>
            </View>
            <View style={[styles.statsItem, styles.statsCompleted]}>
              <Text style={[styles.statsValue, styles.statsValueCompleted]}>
                {completedReadings}
              </Text>
              <Text style={[styles.statsLabel, styles.statsLabelCompleted]}>
                Completas
              </Text>
            </View>
            <View style={[styles.statsItem, styles.statsPending]}>
              <Text style={[styles.statsValue, styles.statsValuePending]}>
                {pendingReadings}
              </Text>
              <Text style={[styles.statsLabel, styles.statsLabelPending]}>
                Pendentes
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  header: {
    backgroundColor: "#1e40af",
    padding: 16,
    alignItems: "center",
  },
  headerText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  statusBarOnline: {
    backgroundColor: "#d1fae5",
  },
  statusBarOffline: {
    backgroundColor: "#fee2e2",
  },
  statusText: {
    fontWeight: "500",
    fontSize: 14,
  },
  statusTextOnline: {
    color: "#047857",
  },
  statusTextOffline: {
    color: "#991b1b",
  },
  icon: {
    marginRight: 8,
  },
  content: {
    padding: 16,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 8,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: "column",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cameraBtn: {
    backgroundColor: "#3b82f6",
  },
  syncBtn: {
    backgroundColor: "#10b981",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  iconWrapper: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  notificationBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  text: {
    marginLeft: 10,
    color: "#9a3412",
    fontSize: 14,
    flex: 1,
  },
  btn: {
    backgroundColor: "#f97316",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    color: "white",
    fontWeight: "500",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
  },
  welcomeIcon: {
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
  },
  statsIcon: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
  routesIcon: {
    backgroundColor: "#f0fdf4",
    color: "#166534",
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  welcomeSubtitle: {
    color: "#64748b",
    marginTop: 4,
    fontSize: 14,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    fontSize: 14,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e40af",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 10,
  },
  statsItem: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  statsTotal: {
    backgroundColor: "#eff6ff",
  },
  statsCompleted: {
    backgroundColor: "#ecfdf5",
  },
  statsPending: {
    backgroundColor: "#fff7ed",
  },
  statsValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statsValueTotal: {
    color: "#2563eb",
    fontWeight: "bold",
  },
  statsValueCompleted: {
    color: "#10b981",
    fontWeight: "bold",
  },
  statsValuePending: {
    color: "#f97316",
    fontWeight: "bold",
  },
  statsLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  statsLabelTotal: {
    color: "#3b82f6",
  },
  statsLabelCompleted: {
    color: "#059669",
  },
  statsLabelPending: {
    color: "#ea580c",
  },
  routesTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#166534",
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  routeCompleted: {
    borderLeftColor: "#10b981",
  },
  routeInProgress: {
    borderLeftColor: "#f59e0b",
  },
  routeNotStarted: {
    borderLeftColor: "#64748b",
  },
  routeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 4,
  },
  routeProgress: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
    color: "#64748b",
    marginRight: 8,
    width: 60,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    flex: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  fillCompleted: {
    backgroundColor: "#10b981",
  },
  fillInProgress: {
    backgroundColor: "#f59e0b",
  },
  fillNotStarted: {
    backgroundColor: "#64748b",
  },
  logoutButton: {
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  logoutButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default AccountScreen;
