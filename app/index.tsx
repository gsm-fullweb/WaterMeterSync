import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import LoginForm from "../components/LoginForm";
import AppLogo from "../components/AppLogo";
import { supabase } from "../utils/supabaseClient";
import { checkOnlineStatus, fetchDailyRoutes } from "../utils/syncService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [networkError, setNetworkError] = useState("");
  const router = useRouter();

  // Check network status on component mount and set up listener
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const online = await checkOnlineStatus();
        setIsOnline(online);
        if (!online) {
          setNetworkError(
            "Você está offline. Algumas funcionalidades podem estar limitadas.",
          );
        } else {
          setNetworkError("");
        }
      } catch (error) {
        console.error("Error checking network status:", error);
        setIsOnline(false);
        setNetworkError("Erro ao verificar status da rede.");
      }
    };

    // Initial check
    checkNetwork();

    // Set up network listener
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected && state.isInternetReachable;
      setIsOnline(!!isConnected);
      if (!isConnected) {
        setNetworkError(
          "Você está offline. Algumas funcionalidades podem estar limitadas.",
        );
      } else {
        setNetworkError("");
      }
    });

    // Clean up listener on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    const checkLoginStatus = async () => {
      setIsCheckingSession(true);
      try {
        // First check if we have a stored token
        const storedToken = await AsyncStorage.getItem("supabase-auth-token");

        // Check for existing session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Error getting session:", sessionError);
          setIsCheckingSession(false);
          return;
        }

        if (session) {
          // User is logged in, redirect to dashboard or daily route
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError) {
            console.error("Error getting user:", userError);
            setIsCheckingSession(false);
            return;
          }

          if (user) {
            // Store user info in AsyncStorage
            await AsyncStorage.setItem("userId", user.id);
            await AsyncStorage.setItem("userEmail", user.email || "");
            await AsyncStorage.setItem(
              "lastLoginTime",
              new Date().toISOString(),
            );

            // Try to get daily routes if online
            if (isOnline) {
              try {
                const routes = await fetchDailyRoutes(user.id);
                if (routes && routes.length > 0) {
                  // Redirect to the first route of the day
                  router.replace(`/route/${routes[0].id}`);
                  return;
                }
              } catch (routeError) {
                console.error("Error fetching daily routes:", routeError);
                // Continue to dashboard if route fetch fails
              }
            }

            // If no routes or offline, go to dashboard
            router.replace("/dashboard");
          }
        } else {
          // No active session
          setIsCheckingSession(false);
        }
      } catch (error) {
        console.error("Error checking login status:", error);
        setIsCheckingSession(false);
      }
    };

    checkLoginStatus();
  }, [isOnline, router]);

  const handleLoginSuccess = async () => {
    setIsLoading(true);
    try {
      // Get current user from Supabase
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("Usuário não encontrado após login");
      }

      // Store user info in AsyncStorage
      await AsyncStorage.setItem("userId", user.id);
      await AsyncStorage.setItem("userEmail", user.email || "");
      await AsyncStorage.setItem("lastLoginTime", new Date().toISOString());

      // Try to get daily routes if online
      if (isOnline) {
        try {
          const routes = await fetchDailyRoutes(user.id);
          if (routes && routes.length > 0) {
            // Redirect to the first route of the day
            router.replace(`/route/${routes[0].id}`);
            return;
          }
        } catch (routeError) {
          console.error("Error fetching daily routes:", routeError);
          // Continue to dashboard if route fetch fails
        }
      }

      // If no routes or offline, go to dashboard
      router.replace("/dashboard");
    } catch (error) {
      console.error("Error after login:", error);
      Alert.alert(
        "Erro",
        `Ocorreu um erro ao processar o login: ${error.message || "Erro desconhecido"}. Tente novamente.`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {isCheckingSession ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-gray-600">Verificando sessão...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 items-center justify-center px-6 py-12">
              <View className="w-full max-w-sm items-center mb-8">
                <AppLogo size="large" showText={true} />
              </View>

              {networkError ? (
                <View className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md w-full max-w-sm">
                  <Text className="text-yellow-700">{networkError}</Text>
                </View>
              ) : null}

              <LoginForm
                onLoginSuccess={handleLoginSuccess}
                isLoading={isLoading}
                isOffline={!isOnline}
              />

              <View className="mt-8 items-center">
                <Text className="text-sm text-gray-500">Versão 1.0.0</Text>
                <Text className="text-xs text-gray-400 mt-1">
                  © 2023 LeituraFácil
                </Text>
                <Text className="text-xs text-gray-400 mt-1">
                  {isOnline ? "🟢 Online" : "🔴 Offline"}
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
