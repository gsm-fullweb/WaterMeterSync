import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatDate } from './dateUtils';

/**
 * Convert readings to CSV format
 * @param {Array} readings - Array of reading objects
 * @returns {string} - CSV string
 */
const readingsToCSV = (readings) => {
  if (!readings || readings.length === 0) {
    return '';
  }
  
  // Cabeçalhos
  const headers = [
    'ID',
    'Medidor',
    'Leitura',
    'Cliente',
    'Endereço',
    'Observações',
    'Data/Hora',
    'Sincronizado',
    'ID Remoto'
  ].join(',');
  
  // Linhas de dados
  const rows = readings.map(reading => {
    return [
      reading.id,
      reading.meter_id,
      reading.reading_value,
      `"${(reading.client_name || '').replace(/"/g, '""')}"`,
      `"${(reading.address || '').replace(/"/g, '""')}"`,
      `"${(reading.notes || '').replace(/"/g, '""')}"`,
      formatDate(reading.timestamp),
      reading.synced ? 'Sim' : 'Não',
      reading.remote_id || ''
    ].join(',');
  });
  
  return [headers, ...rows].join('\n');
};

/**
 * Convert readings to JSON format
 * @param {Array} readings - Array of reading objects
 * @returns {string} - JSON string
 */
const readingsToJSON = (readings) => {
  if (!readings || readings.length === 0) {
    return '[]';
  }
  
  // Formatar e limpar dados para JSON
  const formattedReadings = readings.map(reading => {
    return {
      id: reading.id,
      meter_id: reading.meter_id,
      reading_value: reading.reading_value,
      client_name: reading.client_name || null,
      address: reading.address || null,
      notes: reading.notes || null,
      timestamp: reading.timestamp,
      formatted_date: formatDate(reading.timestamp),
      synced: reading.synced,
      remote_id: reading.remote_id || null
    };
  });
  
  return JSON.stringify(formattedReadings, null, 2);
};

/**
 * Export readings to a file and share it
 * @param {Array} readings - Array of reading objects
 * @param {string} format - Export format ('csv' or 'json')
 * @returns {Promise<string>} - Path to the exported file
 */
export const exportReadings = async (readings, format = 'csv') => {
  if (!readings || readings.length === 0) {
    throw new Error('Não há leituras para exportar');
  }
  
  try {
    // Verificar se o compartilhamento está disponível
    const isAvailable = await Sharing.isAvailableAsync();
    
    if (!isAvailable) {
      throw new Error('Compartilhamento não disponível neste dispositivo');
    }
    
    // Gerar conteúdo do arquivo
    let content = '';
    let fileName = '';
    let mimeType = '';
    
    if (format.toLowerCase() === 'csv') {
      content = readingsToCSV(readings);
      fileName = `leituras_${Date.now()}.csv`;
      mimeType = 'text/csv';
    } else if (format.toLowerCase() === 'json') {
      content = readingsToJSON(readings);
      fileName = `leituras_${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      throw new Error(`Formato não suportado: ${format}`);
    }
    
    // Caminho para o arquivo
    const filePath = `${FileSystem.documentDirectory}${fileName}`;
    
    // Escrever no arquivo
    await FileSystem.writeAsStringAsync(filePath, content);
    
    // Compartilhar arquivo
    await Sharing.shareAsync(filePath, {
      mimeType,
      dialogTitle: `Exportação de Leituras (${format.toUpperCase()})`,
      UTI: format.toLowerCase() === 'csv' ? 'public.comma-separated-values-text' : 'public.json'
    });
    
    return filePath;
  } catch (error) {
    console.error('Error exporting readings:', error);
    throw error;
  }
};