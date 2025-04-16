import { Platform } from 'react-native';
import { READING_TABLE, READING_INDICES, QUERIES } from './schema';

// Variável para armazenar a instância do banco de dados
let db = null;

// Verificar se o SQLite está disponível (ambiente nativo)
const isSQLiteAvailable = () => {
  try {
    // Verificar se estamos em ambiente web
    if (Platform.OS === 'web') {
      return false;
    }
    
    // Importar SQLite dinâmicamente para evitar erros no ambiente web
    const SQLite = require('expo-sqlite');
    
    // Testar se podemos abrir um banco de dados
    try {
      db = SQLite.openDatabase('app_leiturista.db');
      return true;
    } catch (error) {
      console.warn('SQLite not available:', error);
      return false;
    }
  } catch (error) {
    console.warn('Error importing SQLite:', error);
    return false;
  }
};

// Abrir banco de dados apenas se SQLite estiver disponível
const sqliteAvailable = isSQLiteAvailable();

/**
 * Execute uma query SQL
 * @param {string} query - Query SQL a ser executada
 * @param {Array} params - Parâmetros para a query
 * @returns {Promise} - Promise com o resultado da query
 */
const executeQuery = (query, params = []) => {
  // Se SQLite não estiver disponível, retornar erro
  if (!sqliteAvailable || !db) {
    console.error('SQLite database is not available');
    return Promise.reject(new Error('SQLite database is not available'));
  }
  
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        query,
        params,
        (_, result) => resolve(result),
        (_, error) => {
          console.error('Database error:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Initialize the database by creating necessary tables
 */
export const initDatabase = async () => {
  try {
    // Criar tabela de leituras
    await executeQuery(READING_TABLE);
    
    // Criar índices
    for (const index of READING_INDICES) {
      await executeQuery(index);
    }
    
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

/**
 * Save a reading to the local database
 * @param {Object} reading - Reading object to save
 * @returns {Promise<number>} - ID of the saved reading
 */
export const saveReading = async (reading) => {
  try {
    const result = await executeQuery(
      QUERIES.INSERT_READING,
      [
        reading.meter_id,
        reading.reading_value,
        reading.client_name || null,
        reading.address || null,
        reading.notes || null,
        reading.image_path || null,
        reading.timestamp,
        reading.synced ? 1 : 0
      ]
    );
    
    return result.insertId;
  } catch (error) {
    console.error('Error saving reading:', error);
    throw error;
  }
};

/**
 * Get all readings from the local database
 * @returns {Promise<Array>} - Array of reading objects
 */
export const getReadings = async () => {
  try {
    const result = await executeQuery(QUERIES.GET_ALL_READINGS);
    
    const readings = [];
    const rows = result.rows;
    
    for (let i = 0; i < rows.length; i++) {
      readings.push({
        ...rows.item(i),
        synced: rows.item(i).synced === 1
      });
    }
    
    return readings;
  } catch (error) {
    console.error('Error getting readings:', error);
    throw error;
  }
};

/**
 * Get unsynced readings from the local database
 * @returns {Promise<Array>} - Array of unsynced reading objects
 */
export const getUnsyncedReadings = async () => {
  try {
    const result = await executeQuery(QUERIES.GET_UNSYNCED_READINGS);
    
    const readings = [];
    const rows = result.rows;
    
    for (let i = 0; i < rows.length; i++) {
      readings.push({
        ...rows.item(i),
        synced: false
      });
    }
    
    return readings;
  } catch (error) {
    console.error('Error getting unsynced readings:', error);
    throw error;
  }
};

/**
 * Update a reading's sync status in the local database
 * @param {number} id - ID of the reading to update
 * @param {boolean} isSynced - New sync status
 * @returns {Promise<boolean>} - Success status
 */
export const updateReadingSyncStatus = async (id, isSynced, remoteId = null) => {
  try {
    await executeQuery(
      QUERIES.UPDATE_READING_SYNC_STATUS,
      [isSynced ? 1 : 0, remoteId, id]
    );
    
    return true;
  } catch (error) {
    console.error('Error updating reading sync status:', error);
    throw error;
  }
};

/**
 * Clear all data from the database
 * @returns {Promise<boolean>} - Success status
 */
export const clearDatabase = async () => {
  try {
    await executeQuery(QUERIES.DELETE_ALL_READINGS);
    return true;
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
};

/**
 * Get readings count by time period
 * @param {string} startTimestamp - Start of the time period (ISO string)
 * @returns {Promise<number>} - Count of readings in the period
 */
export const getReadingsCountByPeriod = async (startTimestamp) => {
  try {
    const result = await executeQuery(
      QUERIES.GET_READINGS_BY_PERIOD,
      [startTimestamp]
    );
    
    return result.rows.item(0).count;
  } catch (error) {
    console.error('Error getting readings count by period:', error);
    throw error;
  }
};

/**
 * Get a reading by its ID
 * @param {number} id - ID of the reading to get
 * @returns {Promise<Object>} - Reading object
 */
export const getReadingById = async (id) => {
  try {
    const result = await executeQuery(
      QUERIES.GET_READING_BY_ID,
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Reading with ID ${id} not found`);
    }
    
    const reading = result.rows.item(0);
    
    return {
      ...reading,
      synced: reading.synced === 1
    };
  } catch (error) {
    console.error('Error getting reading by ID:', error);
    throw error;
  }
};

/**
 * Update an existing reading
 * @param {Object} reading - Reading object with updated data
 * @returns {Promise<boolean>} - Success status
 */
export const updateReading = async (reading) => {
  try {
    // Primeiro, obter a leitura atual para preservar o caminho da imagem se necessário
    const currentReading = await getReadingById(reading.id);
    
    // Se não há imagem nova mas há uma imagem atual, preservar a imagem
    const imagePath = reading.image_path || (currentReading ? currentReading.image_path : null);
    
    await executeQuery(
      QUERIES.UPDATE_READING,
      [
        reading.meter_id,
        reading.reading_value,
        reading.client_name || null,
        reading.address || null,
        reading.notes || null,
        imagePath,
        reading.synced ? 1 : 0,
        reading.id
      ]
    );
    
    return true;
  } catch (error) {
    console.error('Error updating reading:', error);
    throw error;
  }
};