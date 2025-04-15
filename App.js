import React from 'react';
import { SafeAreaView, Text } from 'react-native';
import { View } from 'react-native';
import "nativewind/tailwind.css";

export default function App() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white">
      <View className="p-4 bg-blue-100 rounded">
        <Text className="text-blue-900 font-bold text-xl">Tailwind funcionando! 🚀</Text>
      </View>
    </SafeAreaView>
  );
}