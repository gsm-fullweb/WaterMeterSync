import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, X } from "lucide-react-native";
import { TouchableOpacity } from "react-native-gesture-handler";

import ProfileHeader from "../components/ProfileHeader";
import DailyStats from "../components/DailyStats";
import AppSettings from "../components/AppSettings";
import { useTheme } from "../context/ThemeContext";

export default function ProfileScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [profileData, setProfileData] = useState({
    userName: "Alex Johnson",
    userId: "MR-7842",
    role: "Leiturista Sênior",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
  });

  const handleLogout = () => {
    // Em um app real, aqui seria o logout da autenticação
    console.log("Saindo...");
    router.replace("/");
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleEditProfile = () => {
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = () => {
    // Em um app real, isso salvaria no backend
    console.log("Salvando dados do perfil:", profileData);
    setIsEditModalVisible(false);
  };

  const handleInputChange = (field, value) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? "bg-dark-background" : "bg-gray-100"}`}
    >
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={isDarkMode ? "#121212" : "#f3f4f6"}
      />

      {/* Cabeçalho com botão de voltar */}
      <View
        className={`flex-row items-center px-4 py-3 ${isDarkMode ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"} border-b`}
      >
        <TouchableOpacity onPress={handleBackPress} className="mr-3">
          <ArrowLeft size={24} color={isDarkMode ? "#BB86FC" : "#3b82f6"} />
        </TouchableOpacity>
        <Text
          className={`text-xl font-bold ${isDarkMode ? "text-dark-text" : "text-gray-800"}`}
        >
          Meu Perfil
        </Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Seção de Cabeçalho do Perfil */}
        <ProfileHeader
          userName={profileData.userName}
          userId={profileData.userId}
          role={profileData.role}
          avatarUrl={profileData.avatarUrl}
          onEditProfile={handleEditProfile}
        />

        <View className="h-4" />

        {/* Seção de Estatísticas Diárias */}
        <DailyStats
          completedReadings={32}
          pendingReadings={5}
          averageTimePerReading={2.8}
          issuesReported={1}
          efficiencyRate={92}
        />

        <View className="h-4" />

        {/* Seção de Configurações */}
        <View
          className={`${isDarkMode ? "bg-dark-surface" : "bg-white"} rounded-lg shadow-sm overflow-hidden`}
        >
          <AppSettings
            onLogout={handleLogout}
            syncFrequency={10}
            dataSavingMode={true}
            cameraResolution="high"
            notificationsEnabled={true}
            autoSync={true}
          />
        </View>

        <View className="h-8" />
      </ScrollView>

      {/* Modal de Edição do Perfil */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalVisible}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className={`w-[90%] ${isDarkMode ? "bg-dark-surface" : "bg-white"} rounded-lg p-5 shadow-lg`}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text
                className={`text-xl font-bold ${isDarkMode ? "text-dark-primary" : "text-blue-900"}`}
              >
                Editar Perfil
              </Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <X size={24} color={isDarkMode ? "#BB86FC" : "#3b82f6"} />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text
                className={`text-sm font-medium ${isDarkMode ? "text-dark-text" : "text-gray-700"} mb-1`}
              >
                Nome
              </Text>
              <TextInput
                className={`border ${isDarkMode ? "border-dark-border bg-dark-background text-dark-text" : "border-gray-300 bg-gray-50"} rounded-md p-2`}
                value={profileData.userName}
                onChangeText={(text) => handleInputChange("userName", text)}
                style={{ color: isDarkMode ? "#E1E1E1" : undefined }}
              />
            </View>

            <View className="mb-4">
              <Text
                className={`text-sm font-medium ${isDarkMode ? "text-dark-text" : "text-gray-700"} mb-1`}
              >
                ID do Funcionário
              </Text>
              <TextInput
                className={`border ${isDarkMode ? "border-dark-border bg-dark-background text-dark-text" : "border-gray-300 bg-gray-50"} rounded-md p-2`}
                value={profileData.userId}
                onChangeText={(text) => handleInputChange("userId", text)}
                style={{ color: isDarkMode ? "#E1E1E1" : undefined }}
              />
            </View>

            <View className="mb-4">
              <Text
                className={`text-sm font-medium ${isDarkMode ? "text-dark-text" : "text-gray-700"} mb-1`}
              >
                Cargo
              </Text>
              <TextInput
                className={`border ${isDarkMode ? "border-dark-border bg-dark-background text-dark-text" : "border-gray-300 bg-gray-50"} rounded-md p-2`}
                value={profileData.role}
                onChangeText={(text) => handleInputChange("role", text)}
                style={{ color: isDarkMode ? "#E1E1E1" : undefined }}
              />
            </View>

            <View className="mb-4">
              <Text
                className={`text-sm font-medium ${isDarkMode ? "text-dark-text" : "text-gray-700"} mb-1`}
              >
                URL do Avatar
              </Text>
              <TextInput
                className={`border ${isDarkMode ? "border-dark-border bg-dark-background text-dark-text" : "border-gray-300 bg-gray-50"} rounded-md p-2`}
                value={profileData.avatarUrl}
                onChangeText={(text) => handleInputChange("avatarUrl", text)}
                style={{ color: isDarkMode ? "#E1E1E1" : undefined }}
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveProfile}
              className={`${isDarkMode ? "bg-dark-primary" : "bg-blue-500"} py-3 rounded-md items-center mt-2`}
            >
              <Text className="text-white font-bold">Salvar Alterações</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
