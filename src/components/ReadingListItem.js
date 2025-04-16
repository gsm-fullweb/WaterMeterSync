import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTimeAgo } from '../utils/dateUtils';

/**
 * Reading list item component
 * @param {Object} props - Component props
 * @param {Object} props.reading - Reading object
 * @param {Function} props.onPress - Callback when item is pressed
 * @returns {JSX.Element} - Reading list item component
 */
const ReadingListItem = ({ reading, onPress }) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        reading.is_facade && styles.facadeContainer
      ]}
      onPress={() => onPress && onPress(reading)}
      activeOpacity={0.7}
    >
      <View style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          {reading.is_facade ? (
            <View style={styles.facadeTag}>
              <Ionicons name="business" size={16} color="#805ad5" />
              <Text style={styles.facadeText}>Fachada</Text>
            </View>
          ) : (
            <Text style={styles.meterId}>Medidor {reading.meter_id}</Text>
          )}
          <View style={styles.syncContainer}>
            {reading.synced ? (
              <Ionicons name="cloud-done" size={16} color="#48bb78" />
            ) : (
              <Ionicons name="cloud-offline" size={16} color="#ed8936" />
            )}
            <Text style={[
              styles.syncStatus,
              { color: reading.synced ? "#48bb78" : "#ed8936" }
            ]}>
              {reading.synced ? "Sincronizado" : "Pendente"}
            </Text>
          </View>
        </View>
        
        <View style={styles.infoContainer}>
          {!reading.is_facade && (
            <View style={styles.valueContainer}>
              <Text style={styles.label}>Leitura:</Text>
              <Text style={styles.readingValue}>{reading.reading_value}</Text>
            </View>
          )}
          
          {reading.client_name && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color="#718096" />
              <Text style={styles.infoText} numberOfLines={1}>
                {reading.client_name}
              </Text>
            </View>
          )}
          
          {reading.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#718096" />
              <Text style={styles.infoText} numberOfLines={1}>
                {reading.address}
              </Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color="#718096" />
            <Text style={styles.infoText}>
              {getTimeAgo(reading.timestamp)}
            </Text>
          </View>
        </View>
      </View>
      
      {reading.image_path && (
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: reading.image_path }} 
            style={styles.thumbnail}
            resizeMode="cover"
          />
        </View>
      )}
      
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color="#a0aec0" 
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#4299e1',
  },
  facadeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e9d8fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  facadeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#805ad5',
    marginLeft: 4,
  },
  facadeContainer: {
    borderLeftColor: '#805ad5',
  },
  contentContainer: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  meterId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatus: {
    fontSize: 12,
    marginLeft: 4,
  },
  infoContainer: {
    marginTop: 4,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#4a5568',
    marginRight: 4,
  },
  readingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d3748',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#4a5568',
    marginLeft: 6,
    flex: 1,
  },
  imageContainer: {
    marginLeft: 10,
    borderRadius: 6,
    overflow: 'hidden',
    width: 60,
    height: 60,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  chevron: {
    alignSelf: 'center',
    marginLeft: 8,
  },
});

export default ReadingListItem;