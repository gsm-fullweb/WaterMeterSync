import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { getStartOfDay, getStartOfMonth, getStartOfYear } from '../utils/dateUtils';

// Importar apenas as funções web diretamente
import {
  initWebStorage,
  saveReadingWeb,
  getReadingsWeb,
  getUnsyncedReadingsWeb,
  updateReadingSyncStatusWeb,
  clearWebStorage,
  getReadingsCountByPeriodWeb,
  getReadingByIdWeb,
  updateReadingWeb
} from '../database/webStorage';

// Verificar se estamos em ambiente web
const isWebPlatform = Platform.OS === 'web';

// Importar funções nativas apenas se não estivermos na web
let initDatabase, saveReading, getReadings, getUnsyncedReadings, 
    updateReadingSyncStatus, clearDatabase, getReadingsCountByPeriod,
    getReadingById, updateReading;

// Importar o módulo nativo apenas se não estivermos na web
if (!isWebPlatform) {
  const nativeModule = require('../database/database');
  initDatabase = nativeModule.initDatabase;
  saveReading = nativeModule.saveReading;
  getReadings = nativeModule.getReadings;
  getUnsyncedReadings = nativeModule.getUnsyncedReadings;
  updateReadingSyncStatus = nativeModule.updateReadingSyncStatus;
  clearDatabase = nativeModule.clearDatabase;
  getReadingsCountByPeriod = nativeModule.getReadingsCountByPeriod;
  getReadingById = nativeModule.getReadingById;
  updateReading = nativeModule.updateReading;
}

/**
 * Hook for database operations
 * @returns {Object} - Database operations and state
 */
export const useDatabase = () => {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    today: 0,
    month: 0,
    year: 0,
    total: 0,
    pendingSync: 0
  });

  // Determinar se estamos em ambiente web ou nativo
  const isWeb = Platform.OS === 'web';

  /**
   * Initialize the database
   */
  const initializeDatabase = useCallback(async () => {
    try {
      setLoading(true);
      if (isWeb) {
        await initWebStorage();
      } else {
        await initDatabase();
      }
      console.log(`Database initialized (${isWeb ? 'web' : 'native'})`);
      await loadData();
    } catch (err) {
      console.error('Error initializing database:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isWeb]);

  /**
   * Load all data from the database
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Buscar leituras
      const data = isWeb ? await getReadingsWeb() : await getReadings();
      setReadings(data);
      
      // Atualizar estatísticas
      await loadStats();
      
      console.log(`Loaded ${data.length} readings from ${isWeb ? 'web storage' : 'database'}`);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isWeb]);

  /**
   * Load reading statistics
   */
  const loadStats = useCallback(async () => {
    try {
      const now = new Date();
      const startOfToday = getStartOfDay(now).toISOString();
      const startOfMonth = getStartOfMonth(now).toISOString();
      const startOfYear = getStartOfYear(now).toISOString();
      
      let todayCount, monthCount, yearCount, pendingSync;
      
      if (isWeb) {
        todayCount = await getReadingsCountByPeriodWeb(startOfToday);
        monthCount = await getReadingsCountByPeriodWeb(startOfMonth);
        yearCount = await getReadingsCountByPeriodWeb(startOfYear);
        pendingSync = (await getUnsyncedReadingsWeb()).length;
      } else {
        todayCount = await getReadingsCountByPeriod(startOfToday);
        monthCount = await getReadingsCountByPeriod(startOfMonth);
        yearCount = await getReadingsCountByPeriod(startOfYear);
        pendingSync = (await getUnsyncedReadings()).length;
      }
      
      setStats({
        today: todayCount,
        month: monthCount,
        year: yearCount,
        total: readings.length,
        pendingSync
      });
    } catch (err) {
      console.error('Error loading stats:', err);
      setError(err.message);
    }
  }, [isWeb, readings.length]);

  /**
   * Save a new reading to the database
   * @param {Object} reading - Reading data to save
   * @returns {Promise<Object>} - Saved reading with ID
   */
  const addReading = useCallback(async (reading) => {
    try {
      const timestamp = new Date().toISOString();
      
      const readingData = {
        ...reading,
        timestamp,
        synced: false
      };
      
      let id;
      
      if (isWeb) {
        id = await saveReadingWeb(readingData);
      } else {
        id = await saveReading(readingData);
      }
      
      const savedReading = { ...readingData, id };
      
      // Atualizar estado
      setReadings(prev => [savedReading, ...prev]);
      
      // Atualizar estatísticas
      await loadStats();
      
      console.log(`Reading saved with ID ${id}`);
      
      return savedReading;
    } catch (err) {
      console.error('Error saving reading:', err);
      setError(err.message);
      throw err;
    }
  }, [isWeb, loadStats]);

  /**
   * Update a reading's sync status
   * @param {number} id - Reading ID
   * @param {boolean} isSynced - New sync status
   * @param {string} remoteId - Remote ID from Supabase
   */
  const updateSyncStatus = useCallback(async (id, isSynced, remoteId = null) => {
    try {
      if (isWeb) {
        await updateReadingSyncStatusWeb(id, isSynced, remoteId);
      } else {
        await updateReadingSyncStatus(id, isSynced, remoteId);
      }
      
      // Atualizar estado
      setReadings(prev => 
        prev.map(reading => 
          reading.id === id ? { ...reading, synced: isSynced, remote_id: remoteId || reading.remote_id } : reading
        )
      );
      
      // Atualizar estatísticas
      await loadStats();
      
      console.log(`Updated sync status for reading ${id} to ${isSynced ? 'synced' : 'not synced'}`);
    } catch (err) {
      console.error('Error updating sync status:', err);
      setError(err.message);
      throw err;
    }
  }, [isWeb, loadStats]);

  /**
   * Clear all data from the database
   * @returns {Promise<boolean>} - Success status
   */
  const clearAllData = useCallback(async () => {
    try {
      if (isWeb) {
        await clearWebStorage();
      } else {
        await clearDatabase();
      }
      
      // Atualizar estado
      setReadings([]);
      
      // Atualizar estatísticas
      setStats({
        today: 0,
        month: 0,
        year: 0,
        total: 0,
        pendingSync: 0
      });
      
      console.log('All data cleared');
      
      return true;
    } catch (err) {
      console.error('Error clearing data:', err);
      setError(err.message);
      throw err;
    }
  }, [isWeb]);

  /**
   * Get unsynced readings
   * @returns {Promise<Array>} - Array of unsynced readings
   */
  const getUnsyncedReadingsData = useCallback(async () => {
    try {
      if (isWeb) {
        return await getUnsyncedReadingsWeb();
      } else {
        return await getUnsyncedReadings();
      }
    } catch (err) {
      console.error('Error getting unsynced readings:', err);
      setError(err.message);
      throw err;
    }
  }, [isWeb]);
  
  /**
   * Get a reading by ID
   * @param {number} id - ID of the reading to get
   * @returns {Promise<Object>} - Reading object
   */
  const getReadingByIdData = useCallback(async (id) => {
    try {
      if (isWeb) {
        return await getReadingByIdWeb(id);
      } else {
        return await getReadingById(id);
      }
    } catch (err) {
      console.error(`Error getting reading with ID ${id}:`, err);
      setError(err.message);
      throw err;
    }
  }, [isWeb]);
  
  /**
   * Update an existing reading
   * @param {Object} reading - Reading object with updated data
   * @returns {Promise<Object>} - Updated reading
   */
  const updateReadingData = useCallback(async (reading) => {
    try {
      // Obter a leitura atual para garantir que nenhum dado seja perdido
      const currentReading = readings.find(r => r.id === reading.id);
      
      // Preservar campos que possam não estar presentes no objeto de atualização
      const updatedReading = {
        ...currentReading,  // Dados atuais como base
        ...reading,         // Sobrescrever com dados atualizados
        // Garantir que o caminho da imagem seja preservado se não houver um novo
        image_path: reading.image_path || (currentReading ? currentReading.image_path : null)
      };
      
      if (isWeb) {
        await updateReadingWeb(updatedReading);
      } else {
        await updateReading(updatedReading);
      }
      
      // Atualizar estado local
      setReadings(prev => 
        prev.map(item => 
          item.id === updatedReading.id ? updatedReading : item
        )
      );
      
      // Atualizar estatísticas
      await loadStats();
      
      console.log(`Reading with ID ${updatedReading.id} updated`);
      
      return updatedReading;
    } catch (err) {
      console.error('Error updating reading:', err);
      setError(err.message);
      throw err;
    }
  }, [isWeb, loadStats, readings]);

  // Inicializar banco de dados na montagem do componente
  useEffect(() => {
    initializeDatabase();
  }, [initializeDatabase]);

  return {
    readings,
    stats,
    loading,
    error,
    addReading,
    updateReading: updateReadingData,
    getReadingById: getReadingByIdData,
    updateSyncStatus,
    clearAllData,
    refreshData: loadData,
    getUnsyncedReadings: getUnsyncedReadingsData,
    isWeb
  };
};