import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getTodaySummary, getTodayRoutes, getPendingReadingsCount } from '../database/database';
import { syncReadings } from '../services/syncService';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [pending, setPending] = useState(0);
  const [routes, setRoutes] = useState([]);
  const [pendingSync, setPendingSync] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const summary = await getTodaySummary();
    const routeList = await getTodayRoutes();
    const pendingCount = await getPendingReadingsCount();
    setTotal(summary.total);
    setCompleted(summary.completed);
    setPending(summary.pending);
    setRoutes(routeList);
    setPendingSync(pendingCount);
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await syncReadings();
      Alert.alert('Sincronização', 'Leituras sincronizadas com sucesso!');
      fetchData(); // Atualiza os dados depois da sincronização
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível sincronizar as leituras.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}><Text style={styles.headerText}>Painel Principal</Text></View>

      <View style={styles.statusBar}>
        <Ionicons name="wifi" size={16} color="#047857" style={{ marginRight: 8 }} />
        <Text style={styles.statusText}>ONLINE | Última Sync: 14:32</Text>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={[styles.actionButton, styles.cameraBtn]} onPress={() => navigation.navigate('Camera')}>
          <View style={styles.iconWrapper}><Feather name="camera" size={24} color="white" /></View>
          <Text style={styles.buttonText}>Nova Leitura</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.syncBtn]} onPress={handleSync}>
          <View style={styles.iconWrapper}>
            <Feather name={isSyncing ? "loader" : "refresh-cw"} size={24} color="white" />
          </View>
          <Text style={styles.buttonText}>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</Text>
        </TouchableOpacity>
      </View>

      {pendingSync > 0 && (
        <View style={styles.notificationBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="bell" size={18} color="#d97706" />
            <Text style={styles.notificationText}> {pendingSync} leituras pendentes para sincronizar</Text>
          </View>
          <TouchableOpacity onPress={handleSync}><Text style={styles.notificationButton}>Sincronizar</Text></TouchableOpacity>
        </View>
      )}

      {/* ... (demais cartões Resumo do Dia e Roteiros permanecem iguais) */}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: { backgroundColor: '#f5f7fa' },
  header: { backgroundColor: '#1e40af', padding: 16 },
  headerText: { color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#d1fae5' },
  statusText: { color: '#047857', fontWeight: '500', fontSize: 14 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12 },
  actionButton: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  cameraBtn: { backgroundColor: '#3b82f6' },
  syncBtn: { backgroundColor: '#10b981' },
  iconWrapper: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 50, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  buttonText: { color: 'white', fontWeight: '600' },
  notificationBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff7ed', borderColor: '#fdba74', borderWidth: 1, borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 16 },
  notificationText: { color: '#9a3412', fontSize: 14, marginLeft: 10, flex: 1 },
  notificationButton: { backgroundColor: '#f97316', color: 'white', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, fontWeight: '500' },
  card: { backgroundColor: 'white', borderRadius: 12, marginHorizontal: 16, marginBottom: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1e3a8a' },
  cardSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  dateText: { color: '#475569', marginLeft: 6, fontSize: 14 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statsItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  statsValue: { fontSize: 24, fontWeight: 'bold' },
  statsLabel: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  routeItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 10, borderLeftWidth: 4 },
  routeInfo: { marginLeft: 12, flex: 1 },
  routeName: { fontSize: 16, fontWeight: '600', color: '#334155' },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  progressText: { fontSize: 12, color: '#64748b', marginRight: 8, width: 60 },
  progressBar: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, flex: 1, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 }
});
