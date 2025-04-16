import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  SafeAreaView,
  RefreshControl,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  getRoteiroDoDia, 
  marcarComoVisitada, 
  sincronizarLeiturasPendentes, 
  getProgressoRoteiro 
} from '../services/syncRoteiro';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Tela do roteiro diário
 * @param {Object} props - Propriedades do componente
 * @returns {JSX.Element} - Componente da tela
 */
const RoteiroScreen = ({ navigation }) => {
  const [roteiro, setRoteiro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataAtual, setDataAtual] = useState(formatarDataISO(new Date()));
  const [progresso, setProgresso] = useState({ total: 0, visitadas: 0, pendentes: 0, percentual: 0 });
  const { isConnected } = useNetworkStatus();
  
  // Função para formatar data no formato ISO (YYYY-MM-DD)
  function formatarDataISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  
  useEffect(() => {
    carregarRoteiro();
  }, [dataAtual]);
  
  // Função para carregar o roteiro do dia
  const carregarRoteiro = async () => {
    try {
      setLoading(true);
      const dados = await getRoteiroDoDia(dataAtual);
      setRoteiro(dados);
      
      // Carregar progresso do roteiro
      const progressoAtual = await getProgressoRoteiro(dataAtual);
      setProgresso(progressoAtual);
    } catch (error) {
      console.error('Erro ao carregar roteiro:', error);
      Alert.alert('Erro', 'Não foi possível carregar o roteiro.');
    } finally {
      setLoading(false);
    }
  };
  
  // Função para marcar um endereço como visitado
  const visitarEndereco = async (rua, casa) => {
    try {
      // Verificar se já foi visitado
      if (casa.visitada) {
        navigation.navigate('ReadingDetails', { id: casa.leitura?.id });
        return;
      }
      
      // Navegar para a tela de leitura
      navigation.navigate('LeituraRoteiro', {
        ruaNome: rua.rua,
        casa: casa,
        dataRoteiro: dataAtual,
        onLeituraCompleta: () => {
          // Atualizar o roteiro após a leitura
          carregarRoteiro();
        }
      });
    } catch (error) {
      console.error('Erro ao visitar endereço:', error);
      Alert.alert('Erro', 'Não foi possível acessar este endereço.');
    }
  };
  
  // Função para atualizar o roteiro (pull-to-refresh)
  const onRefresh = async () => {
    setRefreshing(true);
    
    // Sincronizar leituras pendentes se estiver online
    if (isConnected) {
      try {
        const resultado = await sincronizarLeiturasPendentes();
        if (resultado.success > 0) {
          console.log(`Sincronizadas ${resultado.success} leituras`);
        }
      } catch (error) {
        console.error('Erro ao sincronizar leituras pendentes:', error);
      }
    }
    
    await carregarRoteiro();
    setRefreshing(false);
  };
  
  // Renderizar um item do roteiro (endereço)
  const renderEndereco = ({ item: casa, index, section }) => {
    const rua = section;
    
    return (
      <TouchableOpacity
        style={[
          styles.enderecoItem,
          casa.visitada && styles.enderecoVisitado
        ]}
        onPress={() => visitarEndereco(rua, casa)}
      >
        <View style={styles.enderecoNumero}>
          <Text style={styles.numeroText}>{casa.numero}</Text>
        </View>
        
        <View style={styles.enderecoInfo}>
          <Text style={styles.clienteNome}>{casa.cliente_nome}</Text>
          <Text style={styles.clienteId}>ID: {casa.cliente_id}</Text>
        </View>
        
        <View style={styles.enderecoStatus}>
          {casa.visitada ? (
            <View style={styles.statusVisitado}>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
              <Text style={styles.statusText}>Visitado</Text>
            </View>
          ) : (
            <View style={styles.statusPendente}>
              <Ionicons name="time-outline" size={24} color="#f59e0b" />
              <Text style={styles.statusText}>Pendente</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  // Renderizar o cabeçalho de uma rua
  const renderRuaHeader = ({ section }) => (
    <View style={styles.ruaHeader}>
      <Ionicons name="location" size={24} color="#3b82f6" />
      <Text style={styles.ruaTitle}>{section.rua}</Text>
    </View>
  );
  
  // Formatar a data para exibição
  function formatarDataExibicao(dataISO) {
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, '0');
    
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const mes = meses[data.getMonth()];
    const ano = data.getFullYear();
    
    return `${dia} de ${mes} de ${ano}`;
  }
  
  const dataFormatada = formatarDataExibicao(dataAtual);
  
  // Preparar os dados para SectionList
  const prepararDadosPorSecao = (dados) => {
    if (!dados || !dados.roteiro) return [];
    
    return dados.roteiro.map(rua => ({
      rua: rua.rua,
      data: rua.casas
    }));
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Carregando roteiro...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Cabeçalho da tela */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Roteiro do Dia</Text>
        <Text style={styles.headerDate}>{dataFormatada}</Text>
        
        <View style={styles.connectionStatus}>
          <View style={[
            styles.connectionIndicator,
            isConnected ? styles.online : styles.offline
          ]} />
          <Text style={styles.connectionText}>
            {isConnected ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      
      {/* Barra de progresso */}
      <View style={styles.progressContainer}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {progresso.visitadas} de {progresso.total} casas visitadas
          </Text>
          <Text style={styles.progressPercent}>
            {progresso.percentual}%
          </Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar,
              { width: `${progresso.percentual}%` }
            ]} 
          />
        </View>
      </View>
      
      {/* Lista de endereços por rua */}
      {roteiro && roteiro.roteiro && roteiro.roteiro.length > 0 ? (
        <FlatList
          data={roteiro.roteiro}
          keyExtractor={(item, index) => `rua-${index}`}
          renderItem={({ item: rua, index }) => (
            <View style={styles.ruaContainer}>
              <View style={styles.ruaHeader}>
                <Ionicons name="location" size={24} color="#3b82f6" />
                <Text style={styles.ruaTitle}>{rua.rua}</Text>
              </View>
              
              {rua.casas.map((casa, casaIndex) => (
                <TouchableOpacity
                  key={`casa-${casa.cliente_id}-${casaIndex}`}
                  style={[
                    styles.enderecoItem,
                    casa.visitada && styles.enderecoVisitado
                  ]}
                  onPress={() => visitarEndereco(rua, casa)}
                >
                  <View style={styles.enderecoNumero}>
                    <Text style={styles.numeroText}>{casa.numero}</Text>
                  </View>
                  
                  <View style={styles.enderecoInfo}>
                    <Text style={styles.clienteNome}>{casa.cliente_nome}</Text>
                    <Text style={styles.clienteId}>ID: {casa.cliente_id}</Text>
                  </View>
                  
                  <View style={styles.enderecoStatus}>
                    {casa.visitada ? (
                      <View style={styles.statusVisitado}>
                        <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                        <Text style={styles.statusText}>Visitado</Text>
                      </View>
                    ) : (
                      <View style={styles.statusPendente}>
                        <Ionicons name="time-outline" size={24} color="#f59e0b" />
                        <Text style={styles.statusText}>Pendente</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3b82f6']}
              tintColor="#3b82f6"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#94a3b8" />
              <Text style={styles.emptyText}>
                Nenhum endereço para visitar neste dia
              </Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={onRefresh}
              >
                <Text style={styles.refreshButtonText}>Atualizar</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color="#94a3b8" />
          <Text style={styles.emptyText}>
            Nenhum endereço para visitar neste dia
          </Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Text style={styles.refreshButtonText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  headerDate: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  online: {
    backgroundColor: '#22c55e',
  },
  offline: {
    backgroundColor: '#f97316',
  },
  connectionText: {
    fontSize: 12,
    color: '#64748b',
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#334155',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  ruaContainer: {
    marginBottom: 16,
  },
  ruaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  ruaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 8,
  },
  enderecoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  enderecoVisitado: {
    backgroundColor: '#f0fdf4',
  },
  enderecoNumero: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numeroText: {
    fontWeight: 'bold',
    color: '#0284c7',
  },
  enderecoInfo: {
    flex: 1,
  },
  clienteNome: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  clienteId: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  enderecoStatus: {
    marginLeft: 8,
  },
  statusVisitado: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPendente: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    marginLeft: 4,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  refreshButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default RoteiroScreen;