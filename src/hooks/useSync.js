import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { syncReading } from '../services/supabase';

/**
 * Hook for synchronization with Supabase
 * @param {Function} getUnsyncedReadings - Function to get unsynced readings
 * @param {Function} updateSyncStatusInContext - Function to update sync status
 * @returns {Object} - Sync operations and state
 */
export const useSync = (getUnsyncedReadings, updateSyncStatusInContext) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  
  /**
   * Sync a single reading to Supabase
   * @param {Object} reading - Reading to sync
   * @returns {Promise<boolean>} - Success status
   */
  const sync = useCallback(async (reading) => {
    if (!reading || reading.synced) {
      console.log('Reading already synced or invalid');
      return false;
    }
    
    try {
      const result = await syncReading(reading);
      
      if (result && result.id) {
        // Atualizar status de sincronização localmente
        await updateSyncStatusInContext(reading.id, true, result.id);
        console.log(`Reading ${reading.id} synced successfully`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error syncing reading ${reading.id}:`, error);
      setSyncError(error.message);
      return false;
    }
  }, [updateSyncStatusInContext]);
  
  /**
   * Sync all pending readings to Supabase
   * @returns {Promise<Object>} - Sync results
   */
  const syncAll = useCallback(async () => {
    try {
      setIsSyncing(true);
      setSyncError(null);
      
      // Obter leituras não sincronizadas
      const pendingReadings = await getUnsyncedReadings();
      
      if (pendingReadings.length === 0) {
        console.log('No readings to sync');
        setIsSyncing(false);
        setLastSyncTime(new Date().toISOString());
        return { total: 0, success: 0, failed: 0 };
      }
      
      console.log(`Syncing ${pendingReadings.length} readings...`);
      
      // Sincronizar cada leitura
      const results = await Promise.all(
        pendingReadings.map(reading => sync(reading))
      );
      
      // Contar sucessos e falhas
      const success = results.filter(result => result).length;
      const failed = results.filter(result => !result).length;
      
      console.log(`Sync completed: ${success} success, ${failed} failed`);
      
      setLastSyncTime(new Date().toISOString());
      return { total: pendingReadings.length, success, failed };
    } catch (error) {
      console.error('Error in syncAll:', error);
      setSyncError(error.message);
      return { total: 0, success: 0, failed: 0 };
    } finally {
      setIsSyncing(false);
    }
  }, [getUnsyncedReadings, sync]);
  
  /**
   * Force sync of all pending readings, with user feedback
   */
  const forceSyncAll = useCallback(async () => {
    try {
      // Verificar se há leituras pendentes
      const pendingReadings = await getUnsyncedReadings();
      
      if (pendingReadings.length === 0) {
        Alert.alert('Sincronização', 'Não há leituras pendentes para sincronizar.');
        return;
      }
      
      // Iniciar sincronização
      setIsSyncing(true);
      const results = await syncAll();
      
      // Mostrar resultado
      Alert.alert(
        'Sincronização Concluída',
        `Total: ${results.total}\nSucesso: ${results.success}\nFalhas: ${results.failed}`
      );
    } catch (error) {
      console.error('Error in forceSyncAll:', error);
      Alert.alert('Erro de Sincronização', error.message);
    } finally {
      setIsSyncing(false);
    }
  }, [getUnsyncedReadings, syncAll]);
  
  return {
    sync,
    syncAll,
    forceSyncAll,
    isSyncing,
    lastSyncTime,
    syncError
  };
};