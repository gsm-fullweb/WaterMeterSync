import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Hook for monitoring network connectivity
 * @returns {Object} - Network status information
 */
export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState(null);
  
  useEffect(() => {
    // Função para lidar com mudanças de estado da conexão
    const handleNetworkChange = (state) => {
      setIsConnected(state.isConnected);
      setConnectionType(state.type);
    };
    
    // Obter estado inicial da conexão
    NetInfo.fetch().then(handleNetworkChange);
    
    // Assinar para receber atualizações de estado
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    
    // Cancelar assinatura quando o componente for desmontado
    return () => {
      unsubscribe();
    };
  }, []);
  
  return {
    isConnected,
    connectionType
  };
};