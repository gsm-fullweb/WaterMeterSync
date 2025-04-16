/**
 * SQL statement to create readings table
 */
export const READING_TABLE = `
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meter_id TEXT NOT NULL,
  reading_value TEXT NOT NULL,
  client_name TEXT,
  address TEXT,
  notes TEXT,
  image_path TEXT,
  timestamp TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  remote_id TEXT
);
`;

/**
 * SQL statements to create indices for readings table
 */
export const READING_INDICES = [
  `CREATE INDEX IF NOT EXISTS idx_readings_meter_id ON readings (meter_id);`,
  `CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings (timestamp);`,
  `CREATE INDEX IF NOT EXISTS idx_readings_synced ON readings (synced);`
];

/**
 * Common SQL queries used in the application
 */
export const QUERIES = {
  // Inserir uma nova leitura
  INSERT_READING: `
    INSERT INTO readings (
      meter_id, reading_value, client_name, address, notes, image_path, timestamp, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `,
  
  // Obter todas as leituras, ordenadas pela data mais recente
  GET_ALL_READINGS: `
    SELECT * FROM readings ORDER BY timestamp DESC;
  `,
  
  // Obter leituras não sincronizadas
  GET_UNSYNCED_READINGS: `
    SELECT * FROM readings WHERE synced = 0 ORDER BY timestamp ASC;
  `,
  
  // Atualizar status de sincronização de uma leitura
  UPDATE_READING_SYNC_STATUS: `
    UPDATE readings SET synced = ?, remote_id = ? WHERE id = ?;
  `,
  
  // Atualizar uma leitura existente
  UPDATE_READING: `
    UPDATE readings SET 
      meter_id = ?, 
      reading_value = ?, 
      client_name = ?, 
      address = ?, 
      notes = ?, 
      image_path = ?,
      synced = ?
    WHERE id = ?;
  `,
  
  // Obter uma leitura específica por ID
  GET_READING_BY_ID: `
    SELECT * FROM readings WHERE id = ?;
  `,
  
  // Deletar todas as leituras
  DELETE_ALL_READINGS: `
    DELETE FROM readings;
  `,
  
  // Obter contagem de leituras por período
  GET_READINGS_BY_PERIOD: `
    SELECT COUNT(*) as count FROM readings WHERE timestamp >= ?;
  `,
  
  // Buscar leituras por termo de pesquisa
  SEARCH_READINGS: `
    SELECT * FROM readings 
    WHERE meter_id LIKE ? OR client_name LIKE ? OR address LIKE ? 
    ORDER BY timestamp DESC;
  `
};