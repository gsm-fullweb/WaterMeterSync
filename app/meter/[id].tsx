import React, { useState, useCallback } from "react";
import { Platform } from "react-native";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { ArrowLeft, CheckCircle } from "lucide-react-native";

import MeterDetails from "../../components/MeterDetails";
import ReadingInputSelector from "../../components/ReadingInputSelector";
import ManualReadingInput from "../../components/ManualReadingInput";
import CameraCapture from "../../components/CameraCapture";
import ReadingConfirmation from "../../components/ReadingConfirmation";

export default function MeterReadingScreen() {
  const { id, routeId } = useLocalSearchParams();
  const router = useRouter();

  // Mock data for the meter
  const meterData = {
    address: "123 Main Street, Apt 4B, Cityville",
    meterId: `MTR-${id || "2023-45678"}`,
    customerName: "John Smith",
    previousReading: "45678",
    lastReadDate: "15/04/2023",
    expectedUsage: "400-500 kWh",
    routeId: routeId || "route-123",
  };

  // State management
  const [inputMethod, setInputMethod] = useState<"manual" | "camera">("manual");
  const [readingValue, setReadingValue] = useState<string>("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [visitCompleted, setVisitCompleted] = useState(false);

  // Handle method selection
  const handleMethodSelect = useCallback((method: "manual" | "camera") => {
    setInputMethod(method);
    setShowConfirmation(false);
  }, []);

  // Handle reading submission from manual input
  const handleManualSubmit = useCallback((reading: string) => {
    console.log("Manual reading submitted:", reading);
    setReadingValue(reading);
    setShowConfirmation(true);
  }, []);

  // Handle reading capture from camera
  const handleCameraCapture = useCallback(
    (reading: string, imageUri: string) => {
      setReadingValue(reading);
      setShowConfirmation(true);
      // In a real app, you would store the imageUri as well
    },
    [],
  );

  // Handle reading confirmation
  const handleConfirmReading = useCallback(
    async (value: string) => {
      try {
        console.log("Saving reading value:", value);
        // Generate a unique ID for the reading without using UUID
        const readingId = `reading-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const timestamp = new Date().toISOString();

        // For native platforms, use SQLite
        if (Platform.OS !== "web") {
          // Dynamically import database to avoid issues on web
          const { saveMeterReading } = await import("../../utils/storage");
          const { exec } = await import("../../utils/database");

          const readingData = {
            id: readingId,
            meterId: meterData.meterId,
            addressId: id as string,
            routeId: meterData.routeId,
            value: value,
            timestamp: timestamp,
            imageUri: "", // Add image URI if available
            syncStatus: "pending",
          };

          console.log("Saving reading to SQLite:", readingData);
          await saveMeterReading(readingData);
          console.log("Reading saved to SQLite successfully:", readingId);

          // Also save to leituras table for proper synchronization
          try {
            console.log("Also saving to leituras table...");
            await exec(
              `INSERT INTO leituras (id, residencia_id, cliente_id, leiturista_id, leitura_valor, status, data_leitura, hora_leitura, sincronizado) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                readingId,
                id,
                "1", // Default cliente_id
                "1", // Default leiturista_id
                value,
                "concluido",
                new Date().toISOString().split("T")[0],
                new Date().toISOString().split("T")[1].substring(0, 8),
                0, // Not synchronized yet
              ],
            );
            console.log("Successfully saved to leituras table");
          } catch (leituraError) {
            console.error("Error saving to leituras table:", leituraError);
            // Continue even if this fails, as we already saved to meter_readings
          }
        } else {
          // For web, try to save directly to Supabase
          const { supabase, checkSupabaseConnection } = await import(
            "../../utils/supabaseClient"
          );

          // First check if Supabase connection is working
          const connectionCheck = await checkSupabaseConnection();
          if (!connectionCheck.success) {
            console.error("Supabase connection failed:", connectionCheck.error);
            throw new Error(
              `Supabase connection failed: ${connectionCheck.error?.message || "Unknown error"}`,
            );
          }

          // Try to save to the readings table (new schema)
          try {
            const readingData = {
              id: readingId,
              meter_id: meterData.meterId,
              reading_value: value,
              client_name: meterData.customerName,
              address: meterData.address,
              notes: "",
              timestamp: new Date().toISOString(),
              synced: true,
            };

            console.log(
              "Saving reading to Supabase readings table:",
              readingData,
            );
            const { data: readingsData, error: readingsError } = await supabase
              .from("readings")
              .insert([readingData]);

            if (readingsError) {
              console.error(
                "Error saving to Supabase readings table:",
                readingsError,
              );
              // Continue to try the leituras table as fallback
            } else {
              console.log(
                "Reading saved to Supabase readings table successfully:",
                readingsData,
              );
              return; // Success, no need to try the legacy table
            }
          } catch (readingsError) {
            console.error("Exception saving to readings table:", readingsError);
            // Continue to try the leituras table as fallback
          }

          // Fallback to the leituras table (legacy schema)
          const leituraData = {
            id: readingId,
            residencia_id: id || "default-residencia-id",
            leiturista_id: "1", // Default leiturista ID
            cliente_id: "1", // Default cliente ID
            leitura_valor: value,
            status: "concluido",
            data_leitura: new Date().toISOString().split("T")[0],
            hora_leitura: new Date()
              .toISOString()
              .split("T")[1]
              .substring(0, 8),
            sincronizado: true,
          };

          console.log(
            "Saving reading to Supabase leituras table:",
            leituraData,
          );
          const { data, error } = await supabase
            .from("leituras")
            .insert([leituraData]);

          if (error) {
            console.error("Error saving to Supabase leituras table:", error);
            throw error;
          }

          console.log(
            "Reading saved to Supabase leituras table successfully:",
            data,
          );
        }

        // Update UI to show completion
        setVisitCompleted(true);

        // Show alert with success message
        alert(`Leitura ${value} salva com sucesso!`);

        // After a delay, navigate back to route
        setTimeout(() => {
          router.push(`/route/${meterData.routeId}`);
        }, 2000);
      } catch (error) {
        console.error("Error saving reading:", error);
        alert(
          `Erro ao salvar leitura: ${error instanceof Error ? error.message : "Erro desconhecido"}. Tente novamente.`,
        );
      }
    },
    [router, meterData.routeId, meterData.meterId, id],
  );

  // Handle back button press
  const handleBackPress = useCallback(() => {
    if (routeId) {
      router.replace(`/route/${routeId}`);
    } else {
      router.back();
    }
  }, [router, routeId]);

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white p-4 flex-row items-center border-b border-gray-200">
        <TouchableOpacity onPress={handleBackPress} className="mr-4">
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800">Meter Reading</Text>
        {visitCompleted && (
          <View className="ml-auto flex-row items-center">
            <CheckCircle size={20} color="#10b981" />
            <Text className="ml-2 text-green-600 font-medium">Completed</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="space-y-4">
          {/* Meter Details Component */}
          <MeterDetails
            address={meterData.address}
            meterId={meterData.meterId}
            customerName={meterData.customerName}
            previousReading={meterData.previousReading}
            lastReadDate={meterData.lastReadDate}
            expectedUsage={meterData.expectedUsage}
          />

          {!visitCompleted && (
            <>
              {/* Reading Input Selector */}
              <ReadingInputSelector
                onSelectMethod={handleMethodSelect}
                selectedMethod={inputMethod}
              />

              {/* Conditional rendering based on selected method */}
              {inputMethod === "manual" && !showConfirmation && (
                <ManualReadingInput
                  previousReading={meterData.previousReading}
                  onReadingSubmit={handleManualSubmit}
                  meterType="electric"
                />
              )}

              {inputMethod === "camera" && !showConfirmation && (
                <CameraCapture
                  onCapture={handleCameraCapture}
                  onCancel={() => setInputMethod("manual")}
                  previousReading={meterData.previousReading}
                />
              )}

              {/* Reading Confirmation */}
              {showConfirmation && (
                <ReadingConfirmation
                  readingValue={readingValue}
                  previousReading={meterData.previousReading}
                  meterType="Electric"
                  onEdit={() => setShowConfirmation(false)}
                  onConfirm={handleConfirmReading}
                  addressId={id as string}
                  routeId={meterData.routeId}
                />
              )}
            </>
          )}

          {/* Visit Completed Message */}
          {visitCompleted && (
            <View className="bg-green-50 p-6 rounded-lg border border-green-200 items-center">
              <CheckCircle size={48} color="#10b981" />
              <Text className="text-xl font-bold text-green-800 mt-4">
                Visit Completed
              </Text>
              <Text className="text-center text-green-600 mt-2">
                The meter reading has been recorded successfully and will be
                synchronized when online.
              </Text>
              <TouchableOpacity
                className="mt-6 bg-blue-500 py-3 px-6 rounded-lg"
                onPress={() => router.replace(`/route/${meterData.routeId}`)}
              >
                <Text className="text-white font-medium">Return to Route</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
