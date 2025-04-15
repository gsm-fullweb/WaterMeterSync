import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createMeterReading,
  getAllMeterReadings,
  getMeterReadingsBySyncStatus,
  updateMeterReadingSyncStatus,
  deleteMeterReadingsBySyncStatus,
  initDatabase,
} from "./database";

// Keys for AsyncStorage (keeping for backward compatibility)
export const STORAGE_KEYS = {
  PENDING_READINGS: "pendingReadings",
  LAST_SYNC_TIME: "lastSyncTime",
  USER_DATA: "userData",
  ROUTES_DATA: "routesData",
};

// Types
export interface MeterReading {
  id: string;
  meterId: string;
  addressId: string;
  routeId: string;
  value: string;
  timestamp: string;
  imageUri?: string;
  syncStatus: "pending" | "synced" | "error";
}

// Initialize the database when the app starts
export const initializeStorage = async (): Promise<void> => {
  try {
    await initDatabase();
    console.log("Database initialized");

    // Migrate existing data from AsyncStorage to SQLite (if any)
    await migrateAsyncStorageToSQLite();
  } catch (error) {
    console.error("Error initializing storage:", error);
    throw error;
  }
};

// Migrate data from AsyncStorage to SQLite (one-time operation)
const migrateAsyncStorageToSQLite = async (): Promise<void> => {
  try {
    // Check if migration has already been done
    const migrationDone = await AsyncStorage.getItem("MIGRATION_DONE");
    if (migrationDone === "true") {
      console.log("Migration already completed");
      return;
    }

    // Get existing readings from AsyncStorage
    const readingsJson = await AsyncStorage.getItem(
      STORAGE_KEYS.PENDING_READINGS,
    );
    if (readingsJson) {
      const readings: MeterReading[] = JSON.parse(readingsJson);

      // Save each reading to SQLite
      for (const reading of readings) {
        await createMeterReading(reading);
      }

      console.log(
        `Migrated ${readings.length} readings from AsyncStorage to SQLite`,
      );
    }

    // Mark migration as done
    await AsyncStorage.setItem("MIGRATION_DONE", "true");
  } catch (error) {
    console.error("Error migrating data from AsyncStorage to SQLite:", error);
  }
};

// Save a reading to local storage (SQLite)
export const saveMeterReading = async (
  reading: MeterReading,
): Promise<void> => {
  try {
    console.log("storage.ts - Saving reading to SQLite:", reading);
    await createMeterReading(reading);
    console.log(
      "storage.ts - Reading saved successfully to SQLite:",
      reading.id,
    );

    // Verify the reading was saved by retrieving it
    const readings = await getPendingReadings();
    const savedReading = readings.find((r) => r.id === reading.id);
    console.log("storage.ts - Verification - Reading retrieved:", savedReading);

    if (!savedReading) {
      console.warn("storage.ts - Warning: Reading was not found after saving");
    }
  } catch (error) {
    console.error("storage.ts - Error saving reading to SQLite:", error);
    throw error;
  }
};

// Get all pending readings from SQLite
export const getPendingReadings = async (): Promise<MeterReading[]> => {
  try {
    // Get all readings from SQLite
    console.log("Getting all meter readings from SQLite...");
    const readings = await getAllMeterReadings();
    console.log(
      `Found ${readings.length} total readings in meter_readings table`,
    );
    return readings as MeterReading[];
  } catch (error) {
    console.error("Error getting readings from SQLite:", error);
    return [];
  }
};

// Update reading sync status in SQLite
export const updateReadingSyncStatus = async (
  readingId: string,
  status: "pending" | "synced" | "error",
): Promise<void> => {
  try {
    await updateMeterReadingSyncStatus(readingId, status);
  } catch (error) {
    console.error("Error updating reading sync status in SQLite:", error);
  }
};

// Remove synced readings from SQLite
export const removeSyncedReadings = async (): Promise<void> => {
  try {
    await deleteMeterReadingsBySyncStatus("synced");
  } catch (error) {
    console.error("Error removing synced readings from SQLite:", error);
  }
};

// Save last sync time (still using AsyncStorage for simple key-value data)
export const saveLastSyncTime = async (timestamp: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, timestamp);
  } catch (error) {
    console.error("Error saving last sync time:", error);
  }
};

// Get last sync time (still using AsyncStorage for simple key-value data)
export const getLastSyncTime = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
  } catch (error) {
    console.error("Error getting last sync time:", error);
    return null;
  }
};

// Save routes data for offline access (still using AsyncStorage for now)
export const saveRoutesData = async (routes: any[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.ROUTES_DATA,
      JSON.stringify(routes),
    );
  } catch (error) {
    console.error("Error saving routes data:", error);
  }
};

// Get routes data from offline storage (still using AsyncStorage for now)
export const getRoutesData = async (): Promise<any[]> => {
  try {
    const routesJson = await AsyncStorage.getItem(STORAGE_KEYS.ROUTES_DATA);
    return routesJson ? JSON.parse(routesJson) : [];
  } catch (error) {
    console.error("Error getting routes data:", error);
    return [];
  }
};
