// ✅ src/navigation/index.tsx - Navegação principal com controle de sessão
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import AccountScreen from '../screens/AccountScreen';
import RouteScreen from '../screens/RouteScreen';

export type RootStackParamList = {
  Login: undefined;
  Account: undefined;
  Route: undefined;
};

interface RoutesProps {
  session: any;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

const Routes: React.FC<RoutesProps> = ({ session }) => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={session ? 'Account' : 'Login'}>
        {!session && (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
        {session && (
          <Stack.Screen
            name="Account"
            component={AccountScreen}
            options={{ headerShown: false }}
          />
        )}
        {session && (
          <Stack.Screen
            name="Route"
            component={RouteScreen}
            options={{ title: 'Roteiro' }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Routes;
