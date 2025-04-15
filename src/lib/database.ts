import * as SQLite from "expo-sqlite";
import { v4 as uuidv4 } from "uuid";

// Open the database
export const db = SQLite.openDatabase("leituras.db");

// Utility function to execute a query that returns results
export const query = (sql: string, params: any[] = []): Promise<any[]> =>
  new Promise((resolve, reject) =>
    db.transaction((tx) =>
      tx.executeSql(
        sql,
        params,
        (_, result) => resolve(result.rows._array),
        (_, error) => reject(error),
      ),
    ),
  );

// Utility function to execute SQL without returning results
export const exec = (sql: string, params: any[] = []): Promise<void> =>
  new Promise((resolve, reject) =>
    db.transaction((tx) =>
      tx.executeSql(
        sql,
        params,
        () => resolve(),
        (_, error) => reject(error),
      ),
    ),
  );

// Initialize the database with all required tables
export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        // Leituristas table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS leituristas (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            cidade TEXT NOT NULL
          );`,
        );

        // Bairros table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS bairros (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            cidade TEXT NOT NULL
          );`,
        );

        // Ruas table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS ruas (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            bairro_id TEXT NOT NULL,
            FOREIGN KEY (bairro_id) REFERENCES bairros(id)
          );`,
        );

        // Residências table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS residencias (
            id TEXT PRIMARY KEY,
            rua_id TEXT NOT NULL,
            numero INTEGER NOT NULL,
            FOREIGN KEY (rua_id) REFERENCES ruas(id)
          );`,
        );

        // Clientes table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS clientes (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            cpf TEXT,
            telefone TEXT,
            email TEXT,
            residencia_id TEXT NOT NULL,
            FOREIGN KEY (residencia_id) REFERENCES residencias(id)
          );`,
        );

        // Roteiros table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS roteiros (
            id TEXT PRIMARY KEY,
            leiturista_id TEXT NOT NULL,
            rua_id TEXT NOT NULL,
            dia_semana TEXT NOT NULL,
            FOREIGN KEY (leiturista_id) REFERENCES leituristas(id),
            FOREIGN KEY (rua_id) REFERENCES ruas(id)
          );`,
        );

        // Leituras table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS leituras (
            id TEXT PRIMARY KEY,
            residencia_id TEXT NOT NULL,
            cliente_id TEXT NOT NULL,
            leiturista_id TEXT NOT NULL,
            leitura_valor TEXT,
            foto_path TEXT,
            status TEXT DEFAULT 'pendente',
            data_leitura DATE,
            hora_leitura TIME,
            sincronizado INTEGER DEFAULT 0,
            FOREIGN KEY (residencia_id) REFERENCES residencias(id),
            FOREIGN KEY (cliente_id) REFERENCES clientes(id),
            FOREIGN KEY (leiturista_id) REFERENCES leituristas(id)
          );`,
        );

        // Contas table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS contas (
            id TEXT PRIMARY KEY,
            cliente_id TEXT NOT NULL,
            leitura_id TEXT NOT NULL,
            mes INTEGER NOT NULL,
            ano INTEGER NOT NULL,
            valor_calculado REAL NOT NULL,
            data_emissao DATE NOT NULL,
            data_vencimento DATE NOT NULL,
            status TEXT DEFAULT 'aberta',
            FOREIGN KEY (cliente_id) REFERENCES clientes(id),
            FOREIGN KEY (leitura_id) REFERENCES leituras(id)
          );`,
        );

        // For backward compatibility with the existing AsyncStorage implementation
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS meter_readings (
            id TEXT PRIMARY KEY,
            meterId TEXT NOT NULL,
            addressId TEXT NOT NULL,
            routeId TEXT NOT NULL,
            value TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            imageUri TEXT,
            syncStatus TEXT NOT NULL
          );`,
        );

        // New readings table for the updated schema
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS readings (
            id TEXT PRIMARY KEY,
            meter_id TEXT NOT NULL,
            reading_value TEXT NOT NULL,
            client_name TEXT,
            address TEXT,
            notes TEXT,
            image_path TEXT,
            timestamp TEXT NOT NULL,
            synced INTEGER DEFAULT 0,
            remote_id TEXT,
            latitude REAL,
            longitude REAL
          );`,
        );

        // Create indexes for readings table
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_readings_meter_id ON readings (meter_id);`,
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings (timestamp);`,
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_readings_synced ON readings (synced);`,
        );

        // Daily routes table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS daily_routes (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            total_stops INTEGER DEFAULT 0,
            completed_stops INTEGER DEFAULT 0,
            estimated_time_remaining TEXT DEFAULT 'N/A'
          );`,
        );

        // Create index for daily_routes
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS idx_daily_routes_date ON daily_routes (date);`,
        );
      },
      (error) => {
        console.error("Error creating database tables:", error);
        reject(error);
      },
      () => {
        console.log("Database initialized successfully");
        resolve();
      },
    );
  });
};

// CRUD operations for meter_readings table (for compatibility with existing code)

// Create a new meter reading
export const createMeterReading = (reading: {
  id: string;
  meterId: string;
  addressId: string;
  routeId: string;
  value: string;
  timestamp: string;
  imageUri?: string;
  syncStatus: string;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO meter_readings (
            id, meterId, addressId, routeId, value, timestamp, imageUri, syncStatus
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reading.id,
            reading.meterId,
            reading.addressId,
            reading.routeId,
            reading.value,
            reading.timestamp,
            reading.imageUri || null,
            reading.syncStatus,
          ],
          (_, result) => {
            resolve();
          },
        );
      },
      (error) => {
        console.error("Error creating meter reading:", error);
        reject(error);
      },
    );
  });
};

// CRUD operations for the new readings table

// Create a new reading
export interface Reading {
  id: string;
  meter_id: string;
  reading_value: string;
  client_name?: string;
  address?: string;
  notes?: string;
  image_path?: string;
  timestamp: string;
  synced?: number;
  remote_id?: string;
  latitude?: number;
  longitude?: number;
}

export const createReading = (reading: Reading): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO readings (
            id, meter_id, reading_value, client_name, address, notes, 
            image_path, timestamp, synced, remote_id, latitude, longitude
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reading.id,
            reading.meter_id,
            reading.reading_value,
            reading.client_name || null,
            reading.address || null,
            reading.notes || null,
            reading.image_path || null,
            reading.timestamp,
            reading.synced || 0,
            reading.remote_id || null,
            reading.latitude || null,
            reading.longitude || null,
          ],
          (_, result) => {
            resolve();
          },
        );
      },
      (error) => {
        console.error("Error creating reading:", error);
        reject(error);
      },
    );
  });
};

// Get all meter readings
export const getAllMeterReadings = (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql("SELECT * FROM meter_readings", [], (_, { rows }) => {
          resolve(rows._array);
        });
      },
      (error) => {
        console.error("Error getting meter readings:", error);
        reject(error);
      },
    );
  });
};

// Get all readings from the new readings table
export const getAllReadings = (): Promise<Reading[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql("SELECT * FROM readings", [], (_, { rows }) => {
          resolve(rows._array as Reading[]);
        });
      },
      (error) => {
        console.error("Error getting readings:", error);
        reject(error);
      },
    );
  });
};

// Get readings by sync status
export const getReadingsBySyncStatus = (synced: number): Promise<Reading[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          "SELECT * FROM readings WHERE synced = ?",
          [synced],
          (_, { rows }) => {
            resolve(rows._array as Reading[]);
          },
        );
      },
      (error) => {
        console.error("Error getting readings by sync status:", error);
        reject(error);
      },
    );
  });
};

// Update reading sync status
export const updateReadingSyncStatus = (
  id: string,
  synced: number,
  remote_id?: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          "UPDATE readings SET synced = ?, remote_id = ? WHERE id = ?",
          [synced, remote_id || null, id],
          (_, result) => {
            if (result.rowsAffected > 0) {
              resolve();
            } else {
              reject(new Error("No reading found with the specified ID"));
            }
          },
        );
      },
      (error) => {
        console.error("Error updating reading sync status:", error);
        reject(error);
      },
    );
  });
};

// Get meter readings by sync status
export const getMeterReadingsBySyncStatus = (
  status: string,
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          "SELECT * FROM meter_readings WHERE syncStatus = ?",
          [status],
          (_, { rows }) => {
            resolve(rows._array);
          },
        );
      },
      (error) => {
        console.error("Error getting meter readings by status:", error);
        reject(error);
      },
    );
  });
};

// Update meter reading sync status
export const updateMeterReadingSyncStatus = (
  id: string,
  status: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          "UPDATE meter_readings SET syncStatus = ? WHERE id = ?",
          [status, id],
          (_, result) => {
            if (result.rowsAffected > 0) {
              resolve();
            } else {
              reject(new Error("No reading found with the specified ID"));
            }
          },
        );
      },
      (error) => {
        console.error("Error updating meter reading sync status:", error);
        reject(error);
      },
    );
  });
};

// Delete meter readings by sync status
export const deleteMeterReadingsBySyncStatus = (
  status: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          "DELETE FROM meter_readings WHERE syncStatus = ?",
          [status],
          (_, result) => {
            resolve();
          },
        );
      },
      (error) => {
        console.error("Error deleting meter readings by status:", error);
        reject(error);
      },
    );
  });
};

// Get routes for a specific leiturista
export const getRoutesForLeiturista = (
  leituristaId: string,
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        // Query to get routes from roteiros table
        tx.executeSql(
          `SELECT r.id, ru.nome as rua_nome, b.nome as bairro_nome, r.dia_semana,
           (SELECT COUNT(*) FROM residencias res WHERE res.rua_id = r.rua_id) as total_addresses,
           (SELECT COUNT(*) FROM leituras l 
            JOIN residencias res ON l.residencia_id = res.id 
            WHERE res.rua_id = r.rua_id AND l.status = 'concluido') as completed_addresses
           FROM roteiros r
           JOIN ruas ru ON r.rua_id = ru.id
           JOIN bairros b ON ru.bairro_id = b.id
           WHERE r.leiturista_id = ?
           ORDER BY r.dia_semana, ru.nome`,
          [leituristaId],
          (_, { rows }) => {
            // Format the results to match the expected route format
            const routes = rows._array.map((route) => ({
              id: route.id,
              name: `${route.rua_nome} - ${route.bairro_nome}`,
              completedAddresses: route.completed_addresses || 0,
              totalAddresses: route.total_addresses || 0,
              estimatedTime: calculateEstimatedTime(route.total_addresses),
              isActive: isRouteActiveToday(route.dia_semana),
            }));
            resolve(routes);
          },
        );
      },
      (error) => {
        console.error("Error getting routes for leiturista:", error);
        reject(error);
      },
    );
  });
};

// Helper function to calculate estimated time based on number of addresses
const calculateEstimatedTime = (totalAddresses: number): string => {
  // Assuming each address takes about 10 minutes to process
  const totalMinutes = totalAddresses * 10;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} minutos`;
  } else if (minutes === 0) {
    return `${hours} hora${hours > 1 ? "s" : ""}`;
  } else {
    return `${hours},${Math.floor(minutes / 6)} horas`; // Convert minutes to decimal format
  }
};

// Helper function to check if a route is active today based on day of week
const isRouteActiveToday = (diaSemana: string): boolean => {
  const daysOfWeek = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Check if the route's day matches today
  return diaSemana.toLowerCase() === daysOfWeek[today];
};
