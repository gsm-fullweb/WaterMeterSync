import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Sync indicator component
 * @param {Object} props - Component props
 * @param {boolean} props.isConnected - Flag indicating if online
 * @param {number} props.pendingCount - Number of pending items to sync
 * @param {boolean} props.isSyncing - Flag indicating if syncing is in progress
 * @param {Function} props.onSyncPress - Callback when sync button is pressed
 * @returns {JSX.Element} - Sync indicator component
 */
const SyncIndicator = ({ isConnected, pendingCount, isSyncing, onSyncPress }) => {
  // Se não houver itens pendentes, não exibir o indicador
  if (pendingCount === 0 && !isSyncing) {
    return null;
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <Ionicons 
          name={isConnected ? "wifi" : "wifi-outline"} 
          size={18} 
          color={isConnected ? "#48bb78" : "#f56565"} 
        />
        <Text style={styles.statusText}>
          {isConnected ? "Online" : "Offline"}
        </Text>
        
        {pendingCount > 0 && (
          <View style={styles.pendingContainer}>
            <Ionicons name="cloud-upload-outline" size={16} color="#4a5568" />
            <Text style={styles.pendingText}>
              {pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}
            </Text>
          </View>
        )}
      </View>
      
      {isConnected && pendingCount > 0 && (
        <TouchableOpacity 
          style={styles.syncButton}
          onPress={onSyncPress}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="sync" size={16} color="#fff" />
              <Text style={styles.syncText}>Sincronizar</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#4a5568',
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#edf2f7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 12,
  },
  pendingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#4a5568',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4299e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});

export default SyncIndicator;