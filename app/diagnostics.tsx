import React from "react";
import { View, Text, ScrollView } from "react-native";
import SyncDiagnostics from "../components/SyncDiagnostics";
import SyncDebugger from "../components/SyncDebugger";
import Header from "../components/Header";

export default function DiagnosticsScreen() {
  return (
    <View className="flex-1 bg-white">
      <Header title="Diagnóstico do Sistema" showBackButton={true} />
      <ScrollView className="flex-1">
        <SyncDebugger />
        <SyncDiagnostics />
      </ScrollView>
    </View>
  );
}
