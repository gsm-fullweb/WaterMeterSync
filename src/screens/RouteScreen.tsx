import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { supabase } from "../lib/supabase";

const RouteScreen = (): JSX.Element => {
  const [routes, setRoutes] = useState<any[]>([]);

  useEffect(() => {
    fetchRouteData();
  }, []);

  const fetchRouteData = async () => {
    try {
      const { data, error } = await supabase
        .from("readings")
        .select("id, is_synced, rua");

      if (error) {
        console.error("Erro ao buscar dados da rota:", error.message);
        return;
      }

      console.log("Dados da rota:", data);

      const grouped: { [key: string]: { total: number; feitas: number } } = {};

      data?.forEach((item) => {
        const rua = item.rua || "Sem Rua";
        if (!grouped[rua]) grouped[rua] = { total: 0, feitas: 0 };
        grouped[rua].total++;
        if (item.is_synced) grouped[rua].feitas++;
      });

      setRoutes(
        Object.entries(grouped).map(([rua, info]) => ({
          rua,
          ...info,
        })),
      );
    } catch (err: any) {
      console.error("Erro geral ao buscar dados da rota:", err.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Roteiro do Dia</Text>
      {routes.map((r, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.rua}>{r.rua}</Text>
          <Text style={styles.status}>
            Leituras: {r.feitas}/{r.total}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  card: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  rua: { fontSize: 16, fontWeight: "bold" },
  status: { fontSize: 14, color: "#334155" },
});

export default RouteScreen;
