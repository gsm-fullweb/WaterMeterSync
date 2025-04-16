import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDatabase, useDatabase as useMyDatabase } from '../hooks/useDatabase';

export const AppContext = React.createContext();

export const AppProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [theme, setTheme] = useState('light');
  const [isConnected, setIsConnected] = useState(true);
  const [networkType, setNetworkType] = useState('unknown');
  const [syncSettings, setSyncSettings] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    loadDarkModePreference();
  }, []);

  const loadDarkModePreference = async () => {
    try {
      const isDarkMode = await AsyncStorage.getItem('darkMode');
      setDarkMode(isDarkMode === 'true');
    } catch (error) {
      console.error('Error loading dark mode preference:', error);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newDarkMode = !darkMode;
      await AsyncStorage.setItem('darkMode', newDarkMode.toString());
      setDarkMode(newDarkMode);
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

  return (
    <AppContext.Provider value={{ 
      darkMode,
      toggleDarkMode,
      theme,
      setTheme,
      isConnected,
      networkType,
      syncSettings,
      isSyncing,
      lastSyncTime,
      syncError,
      addReading: useMyDatabase().addReading
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext deve ser usado dentro de um AppProvider');
  }
  return context;
};
