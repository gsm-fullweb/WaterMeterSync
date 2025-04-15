import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MapPin, ArrowLeft, AlertCircle } from "lucide-react-native";
import AddressList from "../../components/AddressList";

interface Address {
  id: string;
  address: string;
  streetName: string;
  houseNumber: string;
  completed: boolean;
  hasIssue: boolean;
  latitude?: number;
  longitude?: number;
}

const RouteDetailPage = () => {
  const { id } = useLocalSearchParams();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<{
    routeName: string;
    addresses: Address[];
    completionStatus: {
      total: number;
      completed: number;
    };
  }>({
    routeName: `Rota ${id || "404"}`,
    addresses: [],
    completionStatus: {
      total: 0,
      completed: 0,
    },
  });

  useEffect(() => {
    const fetchRouteData = async () => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      try {
        // Check if we're on web platform
        if (Platform.OS === "web") {
          // Mock data for web platform since SQLite doesn't work on web
          const mockAddresses = [
            {
              id: "1",
              address: "Rua Carvalho, 123",
              streetName: "Rua Carvalho",
              houseNumber: "123",
              completed: true,
              hasIssue: false,
            },
            {
              id: "2",
              address: "Rua Carvalho, 456",
              streetName: "Rua Carvalho",
              houseNumber: "456",
              completed: false,
              hasIssue: false,
            },
            {
              id: "3",
              address: "Av. Maple, 789",
              streetName: "Av. Maple",
              houseNumber: "789",
              completed: false,
              hasIssue: true,
            },
            {
              id: "4",
              address: "Estrada do Pinheiro, 101",
              streetName: "Estrada do Pinheiro",
              houseNumber: "101",
              completed: false,
              hasIssue: false,
            },
            {
              id: "5",
              address: "Estrada do Pinheiro, 202",
              streetName: "Estrada do Pinheiro",
              houseNumber: "202",
              completed: true,
              hasIssue: false,
            },
          ];

          const total = mockAddresses.length;
          const completed = mockAddresses.filter(
            (addr) => addr.completed,
          ).length;

          setRouteData({
            routeName: `Rota ${id} - Bairro Centro`,
            addresses: mockAddresses,
            completionStatus: {
              total,
              completed,
            },
          });

          if (mockAddresses.length > 0 && !selectedAddressId) {
            setSelectedAddressId(mockAddresses[0].id);
          }
        } else {
          // For native platforms, use SQLite
          // Dynamically import database to avoid issues on web
          const { query } = await import("../../utils/database");

          // Fetch route name
          const routeInfo = await query(
            `SELECT r.id, ru.nome as rua_nome, b.nome as bairro_nome 
             FROM roteiros r
             JOIN ruas ru ON r.rua_id = ru.id
             JOIN bairros b ON ru.bairro_id = b.id
             WHERE r.id = ?`,
            [id],
          );

          if (!routeInfo || routeInfo.length === 0) {
            throw new Error(`Rota com ID ${id} não encontrada`);
          }

          const routeName = `${routeInfo[0].rua_nome} - ${routeInfo[0].bairro_nome}`;

          // Fetch addresses for this route
          const residencias = await query(
            `SELECT res.id, ru.nome as rua_nome, res.numero, 
                    (SELECT COUNT(*) FROM leituras l WHERE l.residencia_id = res.id AND l.status = 'concluido') > 0 as completed,
                    (SELECT COUNT(*) FROM leituras l WHERE l.residencia_id = res.id AND l.status = 'problema') > 0 as has_issue
             FROM roteiros r
             JOIN ruas ru ON r.rua_id = ru.id
             JOIN residencias res ON res.rua_id = ru.id
             WHERE r.id = ?
             ORDER BY ru.nome, res.numero`,
            [id],
          );

          // Transform data to match our Address interface
          const addresses = residencias.map((res: any) => ({
            id: res.id,
            address: `${res.rua_nome}, ${res.numero}`,
            streetName: res.rua_nome,
            houseNumber: res.numero.toString(),
            completed: res.completed === 1,
            hasIssue: res.has_issue === 1,
          }));

          // Calculate completion status
          const total = addresses.length;
          const completed = addresses.filter((addr) => addr.completed).length;

          setRouteData({
            routeName,
            addresses,
            completionStatus: {
              total,
              completed,
            },
          });

          if (addresses.length > 0 && !selectedAddressId) {
            setSelectedAddressId(addresses[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching route data:", err);
        setError(
          err instanceof Error ? err.message : "Erro ao carregar dados da rota",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchRouteData();
  }, [id]);

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
  };

  const router = useRouter();

  const handleNavigateToMeter = (addressId: string) => {
    // Pass the route ID as a query parameter so we can return to the correct route
    router.push({
      pathname: `/meter/${addressId}`,
      params: { routeId: id },
    });
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Cabeçalho */}
      <View className="bg-white pt-12 pb-4 px-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity className="p-2" onPress={() => router.back()}>
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>

          <Text className="text-xl font-bold text-gray-800">
            {routeData.routeName}
          </Text>

          <View className="w-10" />
        </View>

        <View className="mt-2 flex-row justify-between items-center">
          <View className="flex-row items-center">
            <MapPin size={16} color="#4b5563" />
            <Text className="ml-1 text-gray-600">
              {routeData.addresses.length} endereços
            </Text>
          </View>

          <View className="bg-blue-50 px-3 py-1 rounded-full">
            <Text className="text-blue-700 font-medium">
              {routeData.completionStatus.completed}/
              {routeData.completionStatus.total} concluídos
            </Text>
          </View>
        </View>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-gray-600">
            Carregando dados da rota...
          </Text>
        </View>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <View className="flex-1 justify-center items-center px-4">
          <AlertCircle size={48} color="#ef4444" />
          <Text className="mt-4 text-red-600 font-medium text-lg text-center">
            Erro ao carregar dados
          </Text>
          <Text className="mt-2 text-gray-600 text-center">{error}</Text>
          <TouchableOpacity
            className="mt-6 bg-blue-500 px-4 py-2 rounded-lg"
            onPress={() => {
              setIsLoading(true);
              setError(null);
              // Re-trigger the effect
              const tempId = id;
              setTimeout(() => {
                // This will re-trigger the useEffect
                router.replace(`/route/${tempId}`);
              }, 500);
            }}
          >
            <Text className="text-white font-medium">Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de endereços */}
      {!isLoading && !error && (
        <View className="flex-1 mt-4">
          {routeData.addresses.length > 0 ? (
            <AddressList
              addresses={routeData.addresses}
              onAddressPress={handleAddressSelect}
              onNavigatePress={handleNavigateToMeter}
              showSearch={true}
              showFilters={true}
              groupByStreet={true}
            />
          ) : (
            <View className="flex-1 justify-center items-center px-4">
              <Text className="text-gray-600 text-center">
                Nenhum endereço encontrado para esta rota.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default RouteDetailPage;
