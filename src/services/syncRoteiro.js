import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncReading } from './supabase'; // Usando a função existente 
import NetInfo from '@react-native-community/netinfo';

/**
 * Busca o roteiro do dia no Supabase e salva localmente
 * @param {string} data - Data no formato YYYY-MM-DD
 * @returns {Promise<Array>} - Array com o roteiro do dia
 */
export const syncRoteiroDoDia = async (data) => {
  try {
    console.log(`Sincronizando roteiro do dia ${data}`);
    
    // Verificar se já existe o roteiro localmente
    const existingData = await AsyncStorage.getItem(`roteiro-${data}`);
    if (existingData) {
      console.log('Roteiro encontrado localmente');
      return JSON.parse(existingData);
    }
    
    // Verificar conexão com a internet
    const netInfo = await NetInfo.fetch();
    
    if (netInfo.isConnected) {
      // Em um ambiente de produção, aqui faríamos a consulta ao Supabase
      console.log('Modo de demonstração: gerando roteiro fictício');
    } else {
      console.log('Offline: gerando roteiro fictício local');
    }
    
    // Em modo de demonstração, retornar dados fictícios
    const roteiroDemo = gerarRoteiroDemo(data);
    await AsyncStorage.setItem(`roteiro-${data}`, JSON.stringify(roteiroDemo));
    console.log(`Roteiro do dia ${data} salvo localmente`);
    
    return roteiroDemo;
  } catch (error) {
    console.error('Erro ao sincronizar roteiro:', error);
    
    // Em caso de erro, tentar recuperar dados locais
    const dados = await AsyncStorage.getItem(`roteiro-${data}`);
    return dados ? JSON.parse(dados) : gerarRoteiroDemo(data);
  }
};

/**
 * Gera um roteiro fictício para demonstração
 * @param {string} data - Data no formato YYYY-MM-DD
 * @returns {Object} - Objeto com roteiro
 */
const gerarRoteiroDemo = (data) => {
  return {
    data: data,
    roteiro: [
      {
        rua: 'Rua Getúlio Vargas',
        casas: [
          { numero: '123', cliente_id: 'abc123', cliente_nome: 'João Silva', visitada: false },
          { numero: '125', cliente_id: 'abc124', cliente_nome: 'Maria Souza', visitada: false },
          { numero: '127', cliente_id: 'abc125', cliente_nome: 'Carlos Oliveira', visitada: false },
          { numero: '129', cliente_id: 'abc126', cliente_nome: 'Ana Rodrigues', visitada: false }
        ]
      },
      {
        rua: 'Rua 7 de Setembro',
        casas: [
          { numero: '210', cliente_id: 'def123', cliente_nome: 'Pedro Santos', visitada: false },
          { numero: '212', cliente_id: 'def124', cliente_nome: 'Julia Costa', visitada: false },
          { numero: '214', cliente_id: 'def125', cliente_nome: 'Lucas Pereira', visitada: false }
        ]
      },
      {
        rua: 'Av. Paulista',
        casas: [
          { numero: '1520', cliente_id: 'ghi123', cliente_nome: 'Fernanda Lima', visitada: false },
          { numero: '1522', cliente_id: 'ghi124', cliente_nome: 'Roberto Alves', visitada: false },
          { numero: '1524', cliente_id: 'ghi125', cliente_nome: 'Mariana Torres', visitada: false },
          { numero: '1526', cliente_id: 'ghi126', cliente_nome: 'Thiago Martins', visitada: false },
          { numero: '1528', cliente_id: 'ghi127', cliente_nome: 'Bianca Ferreira', visitada: false }
        ]
      }
    ]
  };
};

/**
 * Marca uma casa como visitada
 * @param {string} data - Data do roteiro (YYYY-MM-DD)
 * @param {string} rua - Nome da rua
 * @param {string} clienteId - ID do cliente/casa
 * @param {Object} leitura - Dados da leitura
 * @returns {Promise<boolean>} - Sucesso da operação
 */
export const marcarComoVisitada = async (data, rua, clienteId, leitura = null) => {
  try {
    // Buscar roteiro atual
    const dadosRoteiro = await AsyncStorage.getItem(`roteiro-${data}`);
    if (!dadosRoteiro) return false;
    
    const roteiro = JSON.parse(dadosRoteiro);
    
    // Encontrar a rua e a casa específica
    const ruaIndex = roteiro.roteiro.findIndex(r => r.rua === rua);
    if (ruaIndex === -1) return false;
    
    const casaIndex = roteiro.roteiro[ruaIndex].casas.findIndex(c => c.cliente_id === clienteId);
    if (casaIndex === -1) return false;
    
    // Atualizar status
    roteiro.roteiro[ruaIndex].casas[casaIndex].visitada = true;
    roteiro.roteiro[ruaIndex].casas[casaIndex].horario = new Date().toISOString();
    
    // Se tiver leitura, salvar
    if (leitura) {
      roteiro.roteiro[ruaIndex].casas[casaIndex].leitura = leitura;
    }
    
    // Salvar localmente
    await AsyncStorage.setItem(`roteiro-${data}`, JSON.stringify(roteiro));
    
    // Tentar sincronizar com o servidor se online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      try {
        await sincronizarVisita(data, rua, clienteId, roteiro.roteiro[ruaIndex].casas[casaIndex]);
      } catch (error) {
        console.error('Erro ao sincronizar visita com servidor:', error);
        // Continue mesmo com erro, já salvamos localmente
      }
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao marcar casa como visitada:', error);
    return false;
  }
};

/**
 * Sincroniza uma visita com o servidor
 * @param {string} data - Data do roteiro
 * @param {string} rua - Nome da rua
 * @param {string} clienteId - ID do cliente
 * @param {Object} dadosVisita - Dados completos da visita
 * @returns {Promise<boolean>} - Sucesso da operação
 */
const sincronizarVisita = async (data, rua, clienteId, dadosVisita) => {
  try {
    // Marca como enviada
    dadosVisita.sincronizada = true;
    
    // Em modo de demonstração, apenas logar
    console.log(`Sincronizando visita: ${rua}, ${clienteId}, ${data}`);
    console.log('Dados:', dadosVisita);
    
    // Em produção, enviar ao Supabase
    // await supabase.from('visitas').upsert({
    //   roteiro_data: data,
    //   cliente_id: clienteId,
    //   rua: rua,
    //   data_visita: dadosVisita.horario,
    //   leitura: dadosVisita.leitura 
    // });
    
    return true;
  } catch (error) {
    console.error('Erro ao sincronizar visita com servidor:', error);
    return false;
  }
};

/**
 * Busca o roteiro do dia salvo localmente
 * @param {string} data - Data no formato YYYY-MM-DD
 * @returns {Promise<Object>} - Objeto com roteiro do dia ou null
 */
export const getRoteiroDoDia = async (data) => {
  try {
    const dadosRoteiro = await AsyncStorage.getItem(`roteiro-${data}`);
    if (!dadosRoteiro) {
      // Se não tiver localmente, tentar sincronizar
      return await syncRoteiroDoDia(data);
    }
    
    return JSON.parse(dadosRoteiro);
  } catch (error) {
    console.error('Erro ao buscar roteiro do dia:', error);
    return null;
  }
};

/**
 * Sincroniza leituras pendentes com o servidor
 * @returns {Promise<Object>} - Resultados da sincronização
 */
export const sincronizarLeiturasPendentes = async () => {
  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return { success: 0, failed: 0, offline: true };
    }
    
    // Buscar todas as chaves de roteiros no AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    const roteiroKeys = keys.filter(key => key.startsWith('roteiro-'));
    
    let sincronizadas = 0;
    let falhas = 0;
    
    // Para cada roteiro, verificar casas visitadas e não sincronizadas
    for (const key of roteiroKeys) {
      const dadosRoteiro = await AsyncStorage.getItem(key);
      if (!dadosRoteiro) continue;
      
      const roteiro = JSON.parse(dadosRoteiro);
      let roteiroModificado = false;
      
      // Percorrer cada rua e casa
      roteiro.roteiro.forEach(rua => {
        rua.casas.forEach(casa => {
          if (casa.visitada && casa.leitura && !casa.sincronizada) {
            try {
              // Em modo de demonstração, apenas marcar como sincronizada
              casa.sincronizada = true;
              sincronizadas++;
              roteiroModificado = true;
              
              // Em produção, enviar ao Supabase
              // await supabase.from('leituras').insert({
              //   cliente_id: casa.cliente_id,
              //   valor: casa.leitura.reading_value,
              //   timestamp: casa.horario,
              //   imagem: casa.leitura.image_path
              // });
            } catch (error) {
              console.error('Erro ao sincronizar leitura:', error);
              falhas++;
            }
          }
        });
      });
      
      // Se alguma casa foi modificada, salvar o roteiro atualizado
      if (roteiroModificado) {
        await AsyncStorage.setItem(key, JSON.stringify(roteiro));
      }
    }
    
    return { success: sincronizadas, failed: falhas, offline: false };
  } catch (error) {
    console.error('Erro ao sincronizar leituras pendentes:', error);
    return { success: 0, failed: 0, error: error.message };
  }
};

/**
 * Retorna o progresso do roteiro do dia
 * @param {string} data - Data no formato YYYY-MM-DD
 * @returns {Promise<Object>} - Objeto com estatísticas do progresso
 */
export const getProgressoRoteiro = async (data) => {
  try {
    const roteiro = await getRoteiroDoDia(data);
    if (!roteiro) return { total: 0, visitadas: 0, pendentes: 0, percentual: 0 };
    
    let total = 0;
    let visitadas = 0;
    
    roteiro.roteiro.forEach(rua => {
      rua.casas.forEach(casa => {
        total++;
        if (casa.visitada) visitadas++;
      });
    });
    
    return {
      total,
      visitadas,
      pendentes: total - visitadas,
      percentual: total > 0 ? Math.round((visitadas / total) * 100) : 0
    };
  } catch (error) {
    console.error('Erro ao calcular progresso do roteiro:', error);
    return { total: 0, visitadas: 0, pendentes: 0, percentual: 0 };
  }
};