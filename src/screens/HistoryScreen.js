import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity,
  Alert,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import ReadingListItem from '../components/ReadingListItem';
import SyncIndicator from '../components/SyncIndicator';
import { exportReadings } from '../utils/exportUtils';
import ReadingDetailsScreen from './ReadingDetailsScreen';

const HistoryScreen = ({ navigation }) => {
  const { 
    readings, 
    isConnected, 
    isSyncing, 
    pendingCount, 
    forceSyncReadings 
  } = useAppContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredReadings, setFilteredReadings] = useState([]);
  const [selectedReadingId, setSelectedReadingId] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Atualizar leituras filtradas quando as leituras ou a busca mudar
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredReadings(readings);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = readings.filter(reading => 
      reading.meter_id.toLowerCase().includes(query) ||
      reading.client_name?.toLowerCase().includes(query) ||
      reading.address?.toLowerCase().includes(query) ||
      reading.reading_value.toLowerCase().includes(query)
    );
    
    setFilteredReadings(filtered);
  }, [readings, searchQuery]);
  
  // Exportar leituras
  const handleExport = async (format) => {
    try {
      if (readings.length === 0) {
        Alert.alert('Exportação', 'Não há leituras para exportar.');
        return;
      }
      
      await exportReadings(readings, format);
      Alert.alert('Exportação', `Leituras exportadas com sucesso no formato ${format.toUpperCase()}.`);
    } catch (error) {
      console.error('Error exporting readings:', error);
      Alert.alert('Erro na Exportação', error.message || 'Ocorreu um erro ao exportar as leituras.');
    }
  };
  
  // Mostrar o menu de exportação
  const showExportMenu = () => {
    Alert.alert(
      'Exportar Leituras',
      'Escolha o formato de exportação:',
      [
        {
          text: 'CSV',
          onPress: () => handleExport('csv')
        },
        {
          text: 'JSON',
          onPress: () => handleExport('json')
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };
  
  // Lidar com seleção de leitura
  const handleReadingPress = (readingId) => {
    setSelectedReadingId(readingId);
    setIsModalVisible(true);
  };
  
  // Fechar o modal
  const handleCloseModal = () => {
    setIsModalVisible(false);
  };
  
  // Renderizar o item da lista
  const renderItem = ({ item }) => (
    <ReadingListItem 
      reading={item} 
      onPress={() => handleReadingPress(item.id)}
    />
  );
  
  // Renderizar o cabeçalho da lista
  const ListHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#718096" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por ID, cliente ou endereço..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#718096" />
          </TouchableOpacity>
        ) : null}
      </View>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={showExportMenu}
        >
          <Ionicons name="download-outline" size={20} color="#4299e1" />
          <Text style={styles.actionText}>Exportar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // Renderizar quando não há resultados
  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      {searchQuery ? (
        <>
          <Ionicons name="search" size={64} color="#a0aec0" />
          <Text style={styles.emptyText}>
            Nenhum resultado encontrado
          </Text>
          <Text style={styles.emptySubtext}>
            Tente buscar por outro termo
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="water-outline" size={64} color="#a0aec0" />
          <Text style={styles.emptyText}>
            Nenhuma leitura registrada ainda
          </Text>
          <Text style={styles.emptySubtext}>
            Toque em "Nova Leitura" para começar
          </Text>
        </>
      )}
    </View>
  );
  
  return (
    <View style={styles.container}>
      <FlatList
        data={filteredReadings}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyList}
      />
      
      <SyncIndicator 
        isConnected={isConnected}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSyncPress={forceSyncReadings}
      />
      
      {/* Modal para detalhes da leitura */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        onRequestClose={handleCloseModal}
        transparent={false}
      >
        {selectedReadingId && (
          <ReadingDetailsScreen 
            route={{ params: { readingId: selectedReadingId } }}
            navigation={{ 
              goBack: handleCloseModal 
            }}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#4a5568',
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#ebf8ff',
  },
  actionText: {
    fontSize: 14,
    color: '#4299e1',
    marginLeft: 6,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#4a5568',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
  },
});

export default HistoryScreen;