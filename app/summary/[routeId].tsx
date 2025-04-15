import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { getPendingReadings } from "../../utils/storage";
import {
  syncPendingReadings,
  checkOnlineStatus,
} from "../../utils/syncService";
import { ArrowLeft, Home } from "lucide-react-native";

import RouteSummary from "../../components/RouteSummary";
import IssuesList from "../../components/IssuesList";
import SyncControl from "../../components/SyncControl";

export default function RouteSummaryScreen() {
  // Check online status and pending readings on mount
  useEffect(() => {
    const checkStatus = async () => {
      // Check online status
      const isOnline = await checkOnlineStatus();
      setSyncStatus(isOnline ? "online" : "offline");

      // Check pending readings
      const pendingReadings = await getPendingReadings();
      setPendingUploads(
        pendingReadings.filter((r) => r.syncStatus === "pending").length,
      );
    };

    checkStatus();
  }, []);
  const { routeId } = useLocalSearchParams();
  const [syncStatus, setSyncStatus] = useState<
    "online" | "offline" | "syncing" | "completed" | "error"
  >("online");
  const [pendingUploads, setPendingUploads] = useState(0);

  // Mock data for the route summary
  const routeSummaryData = {
    routeName: `Route #${routeId}`,
    totalAddresses: 24,
    completedVisits: 22,
    skippedLocations: 2,
    timeTaken: "3h 45m",
    completionPercentage: 92,
  };

  const handleSyncPress = async () => {
    if (syncStatus === "offline") {
      Alert.alert(
        "Offline",
        "Cannot sync while offline. Please check your connection.",
      );
      return;
    }

    setSyncStatus("syncing");

    try {
      // Actual sync process
      const result = await syncPendingReadings();

      setSyncStatus(result.success ? "completed" : "error");

      if (result.success) {
        Alert.alert(
          "Sync Complete",
          `Successfully synchronized ${result.syncedCount} readings.`,
        );
      } else {
        Alert.alert(
          "Sync Incomplete",
          `Synchronized ${result.syncedCount} readings, but ${result.errorCount} failed.`,
        );
      }

      // Update pending count
      const pendingReadings = await getPendingReadings();
      setPendingUploads(
        pendingReadings.filter((r) => r.syncStatus === "pending").length,
      );
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus("error");
      Alert.alert("Sync Error", "An error occurred during synchronization.");
    }
  };

  const navigateToDashboard = () => {
    router.replace("/dashboard");
  };

  return (
    <View className="flex-1 bg-gray-100">
      <Stack.Screen
        options={{
          headerTitle: "Route Summary",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <ArrowLeft size={24} color="#0f172a" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={navigateToDashboard} className="ml-4">
              <Home size={24} color="#0f172a" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1 p-4">
        <View className="space-y-6">
          {/* Route Summary Component */}
          <RouteSummary
            routeName={routeSummaryData.routeName}
            totalAddresses={routeSummaryData.totalAddresses}
            completedVisits={routeSummaryData.completedVisits}
            skippedLocations={routeSummaryData.skippedLocations}
            timeTaken={routeSummaryData.timeTaken}
            completionPercentage={routeSummaryData.completionPercentage}
          />

          {/* Issues List Component */}
          <IssuesList
            onIssuePress={(issue) => {
              Alert.alert(
                `${issue.type.charAt(0).toUpperCase() + issue.type.slice(1)} Issue`,
                `${issue.description}\n\nLocation: ${issue.address}\nReported: ${issue.timestamp}`,
                [
                  { text: "Mark as Resolved", style: "default" },
                  { text: "Close", style: "cancel" },
                ],
              );
            }}
          />

          {/* Sync Control Component */}
          <SyncControl
            routeId={routeId as string}
            syncStatus={syncStatus}
            lastSyncTime={new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            pendingUploads={pendingUploads}
            onSyncPress={handleSyncPress}
          />

          {/* Complete Route Button */}
          <TouchableOpacity
            className="bg-green-500 py-4 rounded-lg mb-8"
            onPress={() => {
              Alert.alert(
                "Complete Route",
                "Are you sure you want to mark this route as complete?",
                [
                  {
                    text: "Yes",
                    onPress: () => {
                      // Handle route completion
                      Alert.alert(
                        "Route Completed",
                        "This route has been marked as complete.",
                      );
                      navigateToDashboard();
                    },
                  },
                  { text: "No", style: "cancel" },
                ],
              );
            }}
          >
            <Text className="text-white font-bold text-center text-lg">
              Complete Route
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
