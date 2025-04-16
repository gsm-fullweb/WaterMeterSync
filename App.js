import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Platform } from 'react-native';
import { AppProvider } from './src/context/AppContext';
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';

// Importação de telas
import HomeScreen from './src/screens/HomeScreen';
import ReadingScreen from './src/screens/ReadingScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FacadeScreen from './src/screens/FacadeScreen';
import RoteiroScreen from './src/screens/RoteiroScreen';
import LeituraRoteiroScreen from './src/screens/LeituraRoteiroScreen';
import ReadingDetailsScreen from './src/screens/ReadingDetailsScreen';

// Criação dos navegadores
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Componente de mensagem de ambiente web
const WebNotice = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  
  return (
    <View style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      backgroundColor: '#4299e1', 
      padding: 10, 
      alignItems: 'center',
      zIndex: 1000 
    }}>
      <Text style={{ color: 'white', fontWeight: 'bold' }}>
        Versão Web - Algumas funcionalidades nativas estão simuladas
      </Text>
      <Text 
        style={{ color: 'white', marginTop: 5, textDecorationLine: 'underline' }}
        onPress={() => setDismissed(true)}
      >
        Fechar
      </Text>
    </View>
  );
};

// Roteamento principal com abas de navegação
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          // Definir ícones para cada rota
          if (route.name === 'Início') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Nova Leitura') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Roteiro') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Fachada') {
            iconName = focused ? 'business' : 'business-outline';
          } else if (route.name === 'Histórico') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Configurações') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          // Retornar o ícone
          return <Ionicons testID="tab-icon" name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4299e1',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Início" 
        component={HomeScreen}
        options={{
          title: 'AppLeiturista',
        }} 
      />
      <Tab.Screen 
        name="Nova Leitura" 
        component={ReadingScreen}
        options={{
          title: 'Nova Leitura',
        }} 
      />
      <Tab.Screen 
        name="Roteiro" 
        component={RoteiroScreen}
        options={{
          title: 'Roteiro do Dia',
        }} 
      />
      <Tab.Screen 
        name="Fachada" 
        component={FacadeScreen}
        options={{
          title: 'Foto da Fachada',
        }} 
      />
      <Tab.Screen 
        name="Histórico" 
        component={HistoryScreen}
        options={{
          title: 'Histórico de Leituras',
        }} 
      />
      <Tab.Screen 
        name="Configurações" 
        component={SettingsScreen}
        options={{
          title: 'Configurações',
        }} 
      />
    </Tab.Navigator>
  );
};

/**
 * Aplicativo principal - AppLeiturista
 * Um aplicativo para leituristas de água com funcionalidade offline,
 * OCR para leitura automática de medidores e sincronização com Supabase.
 */
export default function App() {
  const isWeb = Platform.OS === 'web';
  
  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        {isWeb && <WebNotice />}
        
        <Stack.Navigator
          screenOptions={{
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          {/* Tela principal com abas de navegação */}
          <Stack.Screen 
            name="Main" 
            component={MainTabNavigator} 
            options={{ headerShown: false }}
          />
          
          {/* Telas sem abas (fluxo de navegação) */}
          <Stack.Screen 
            name="LeituraRoteiro" 
            component={LeituraRoteiroScreen}
            options={{ 
              title: 'Registrar Leitura',
              presentation: 'card',
            }}
          />
          
          <Stack.Screen 
            name="ReadingDetails" 
            component={ReadingDetailsScreen}
            options={{ 
              title: 'Detalhes da Leitura',
              presentation: 'card',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}