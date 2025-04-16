import { getUnsyncedReadings, updateReadingSyncStatus } from './database';
import { syncReading } from './supabase';

/**
 * Sincroniza todas as leituras locais (SQLite) com o Supabase
 */
export const syncReadings = async () => {
  try {
    const unsynced = await getUnsyncedReadings();
    if (unsynced.length === 0) {
      console.log('✅ Nenhuma leitura pendente para sincronizar.');
      return;
    }

    for (const reading of unsynced) {
      const result = await syncReading(reading);

      if (result.success) {
        await updateReadingSyncStatus(reading.id, true, result.remoteId);
        console.log(`✔️ Leitura ${reading.id} sincronizada com sucesso (ID remoto: ${result.remoteId})`);
      } else {
        console.warn(`⚠️ Falha ao sincronizar leitura ${reading.id}:`, result.error);
      }
    }

    console.log('🔄 Sincronização completa.');
  } catch (error) {
    console.error('Erro ao sincronizar leituras:', error);
  }
};
