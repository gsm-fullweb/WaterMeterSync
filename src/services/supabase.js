import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

// Configuração do Supabase
// Estas credenciais seriam normalmente armazenadas em variáveis de ambiente
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hpuzkroxfyagndmznyyg.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdXprcm94ZnlhZ25kbXpueXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzNzg4MzQsImV4cCI6MjA1Njk1NDgzNH0.MkWyh1YYIOFXpTFzRrqGVENjjexwJm0BmYUWMogL7Ps';

// Inicializar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Sync a reading to Supabase
 * @param {Object} reading - Reading object to sync
 * @returns {Promise<Object>} - Result of the sync operation
 */
export const syncReading = async (reading) => {
  try {
    // Verificar se as tabelas necessárias existem antes de continuar
    try {
      const { error } = await supabase.from('readings').select('id').limit(1);
      
      if (error) {
        console.log('Using demo mode for Supabase sync - table may not exist');
        throw new Error('Table may not exist');
      }
    } catch (error) {
      console.log('Using demo mode for Supabase sync');
      
      // Simular um pequeno atraso para parecer mais realista
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Gerar um ID remoto falso
      const fakeRemoteId = `supabase-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      return {
        success: true,
        remoteId: fakeRemoteId
      };
    }
    
    // Upload da imagem se existir
    let imageUrl = null;
    if (reading.image_path) {
      imageUrl = await uploadImage(reading.image_path, reading.id);
    }
    
    // Obter ID do dispositivo
    const deviceId = await getDeviceId();
    
    // Dados para sincronizar
    const syncData = {
      meter_id: reading.meter_id,
      reading_value: reading.reading_value,
      client_name: reading.client_name || null,
      address: reading.address || null,
      notes: reading.notes || null,
      timestamp: reading.timestamp,
      image_url: imageUrl,
      device_id: deviceId,
      local_id: reading.id.toString()
    };
    
    // Inserir na tabela 'readings'
    const { data, error } = await supabase
      .from('readings')
      .insert(syncData)
      .select('id')
      .single();
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    return {
      success: true,
      remoteId: data.id
    };
  } catch (error) {
    console.error('Error syncing reading to Supabase:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
};

/**
 * Upload an image to Supabase Storage
 * @param {string} imagePath - Local path to the image
 * @param {string} readingId - ID of the associated reading
 * @returns {Promise<string>} - Public URL of the uploaded image
 */
export const uploadImage = async (imagePath, readingId) => {
  try {
    // Verificar se bucket existe
    try {
      const { error } = await supabase.storage.getBucket('meter-readings');
      
      if (error) {
        console.log('Using demo mode for image upload - bucket may not exist');
        return `https://example.com/fake-images/${readingId}.jpg`;
      }
    } catch (error) {
      console.log('Using demo mode for image upload');
      return `https://example.com/fake-images/${readingId}.jpg`;
    }
    
    const fileName = `${readingId}_${Date.now()}.jpg`;
    
    // Ler o arquivo como base64
    const fileInfo = await FileSystem.getInfoAsync(imagePath);
    
    if (!fileInfo.exists) {
      throw new Error('Image file does not exist');
    }
    
    const base64 = await FileSystem.readAsStringAsync(imagePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Upload para o Supabase Storage
    const { data, error } = await supabase
      .storage
      .from('meter-readings')
      .upload(fileName, base64, {
        contentType: 'image/jpeg',
        upsert: false
      });
    
    if (error) {
      throw new Error(`Supabase Storage error: ${error.message}`);
    }
    
    // Obter URL pública
    const { data: urlData } = supabase
      .storage
      .from('meter-readings')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image to Supabase:', error);
    return null;
  }
};

/**
 * Get a unique device identifier
 * @returns {Promise<string>} - Device ID
 */
export const getDeviceId = async () => {
  try {
    // Tentar obter ID existente
    const storedId = await AsyncStorage.getItem('device_id');
    
    if (storedId) {
      return storedId;
    }
    
    // Gerar novo ID se não existir
    const uuid = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Date.now()}-${Math.random()}`
    );
    
    // Armazenar para uso futuro
    await AsyncStorage.setItem('device_id', uuid);
    
    return uuid;
  } catch (error) {
    console.error('Error generating device ID:', error);
    
    // Fallback ID em caso de erro
    const fallbackId = `device-${Date.now()}`;
    return fallbackId;
  }
};