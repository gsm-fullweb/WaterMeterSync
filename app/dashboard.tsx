import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  SafeAreaView,
  Text,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { getPendingReadings, getLastSyncTime } from "../utils/storage";
import {
  setupNetworkListener,
  syncPendingReadings,
  syncFromSupabase,
  syncToSupabase,
} from "../utils/syncService";
import { getRoutesForLeiturista } from "../utils/database";
import { Bell } from "lucide-react-native";

import Header from "../components/Header";
import SyncStatusBar from "../components/SyncStatusBar";
import DashboardMenu from "../components/DashboardMenu";
import RoutesList from "../components/RoutesList";

export default function Dashboard() {
  // Function to load daily stats from the database
  const loadDailyStats = async () => {
    try {
      // Get all readings from the database
      const readings = await getPendingReadings();

      // Calculate stats
      const total = readings.length;
      const completed = readings.filter(
        (r) => r.syncStatus === "synced",
      ).length;
      const pending = readings.filter((r) => r.syncStatus === "pending").length;

      // Update state
      setDailyStats({
        totalReadings: total,
        completedReadings: completed,
        pendingReadings: pending,
      });
    } catch (error) {
      console.error("Error loading daily stats:", error);
    }
  };

  // Function to load routes for the current leiturista
  const loadRoutesForLeiturista = async () => {
    try {
      setRoutesLoading(true);
      setRoutesError(null);

      // Get routes from the database
      const routesData = await getRoutesForLeiturista(leituristaId);

      // Update state with the routes
      setRoutes(routesData);
    } catch (error) {
      console.error("Error loading routes for leiturista:", error);
      setRoutesError(
        "Não foi possível carregar os roteiros. Tente novamente mais tarde.",
      );
    } finally {
      setRoutesLoading(false);
    }
  };

  // Set up network listener and load initial data
  useEffect(() => {
    // Create a cleanup controller
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Flag to track component mount state
    let isComponentMounted = true;

    // Load pending readings count
    const loadPendingReadings = async () => {
      // Check if component is still mounted
      if (!isComponentMounted) return;

      try {
        const pendingReadings = await getPendingReadings();
        // Only update state if component is still mounted
        if (isComponentMounted) {
          setPendingUploads(
            pendingReadings.filter((r) => r.syncStatus === "pending").length,
          );
        }

        // Load last sync time
        try {
          const lastSync = await getLastSyncTime();
          if (lastSync && isComponentMounted) {
            const date = new Date(lastSync);
            setLastSyncTime(
              date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            );
          }
        } catch (syncTimeError) {
          console.error("Error loading last sync time:", syncTimeError);
          // Continue despite this error
        }
      } catch (error) {
        console.error("Error loading pending readings:", error);
        // Set default values in case of error, but only if component is still mounted
        if (isComponentMounted) {
          setPendingUploads(0);
        }
      }
    };

    // Execute loading function with error handling
    // Wrap in Promise.resolve to handle any synchronous errors
    const loadDataPromise = Promise.resolve()
      .then(() => {
        if (isComponentMounted) {
          return Promise.all([
            loadPendingReadings(),
            loadDailyStats(),
            loadRoutesForLeiturista(),
          ]);
        }
      })
      .catch((err) => {
        console.error("Failed to load initial data:", err);
      });

    // Set up network listener with proper cleanup
    let unsubscribe: (() => void) | null = null;

    try {
      // Create a safe callback that checks mount state
      const safeNetworkCallback = (isConnected: boolean) => {
        // Only update state if component is still mounted
        if (isComponentMounted) {
          try {
            setIsOnline(isConnected);
            setSyncStatus(isConnected ? "online" : "offline");
          } catch (error) {
            console.error("Error updating connection status in UI:", error);
          }
        }
      };

      // Set up the network listener
      unsubscribe = setupNetworkListener(safeNetworkCallback);
    } catch (error) {
      console.error("Failed to setup network listener:", error);
    }

    // Cleanup function
    return () => {
      // Mark component as unmounted first to prevent any further state updates
      isComponentMounted = false;

      // Signal abort to any pending operations
      try {
        abortController.abort();
      } catch (abortError) {
        console.error("Error aborting pending operations:", abortError);
      }

      // Safe unsubscribe to prevent premature close
      try {
        // Unsubscribe immediately to stop new events
        if (unsubscribe && typeof unsubscribe === "function") {
          unsubscribe();
          unsubscribe = null;
        }
      } catch (error) {
        console.error("Error in unsubscribe:", error);
      }

      // Cancel any pending promises
      try {
        if (loadDataPromise && typeof loadDataPromise.cancel === "function") {
          loadDataPromise.cancel();
        }
      } catch (cancelError) {
        console.error("Error cancelling pending promises:", cancelError);
      }
    };
  }, []);
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState("--:--");
  const [syncStatus, setSyncStatus] = useState<
    | "online"
    | "offline"
    | "syncing"
    | "completed"
    | "error"
    | "downloading"
    | "uploading"
  >("online");

  // Daily stats state
  const [dailyStats, setDailyStats] = useState({
    totalReadings: 0,
    completedReadings: 0,
    pendingReadings: 0,
  });

  // Current leiturista ID (would come from user authentication in a real app)
  const [leituristaId, setLeituristaId] = useState<string>("1"); // Default leiturista ID

  // State for routes data
  const [routes, setRoutes] = useState<
    Array<{
      id: string;
      name: string;
      completedAddresses: number;
      totalAddresses: number;
      estimatedTime: string;
      isActive?: boolean;
    }>
  >([]);

  // State for routes loading
  const [routesLoading, setRoutesLoading] = useState<boolean>(true);
  const [routesError, setRoutesError] = useState<string | null>(null);

  // Function to handle morning sync (download from Supabase to SQLite)
  const handleMorningSync = async () => {
    // Update daily stats before syncing
    await loadDailyStats();
    // Also refresh routes data
    await loadRoutesForLeiturista();
    if (!isOnline) {
      return; // Can't sync when offline
    }

    // Create an abort controller for this sync operation
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Start sync process
    setSyncStatus("downloading");

    // Use a flag to track if the component is still active during this operation
    let isActive = true;
    // Store timeout ID in a higher scope for reliable cleanup
    let timeoutId: NodeJS.Timeout | null = null;

    // Create a cleanup function that can be called from multiple places
    const cleanup = () => {
      // Mark as inactive first
      isActive = false;

      // Clear any pending timeout
      if (timeoutId !== null) {
        try {
          clearTimeout(timeoutId);
          timeoutId = null;
        } catch (clearError) {
          console.error("Error clearing timeout during cleanup:", clearError);
        }
      }

      // Abort any pending operations
      try {
        if (!signal.aborted) {
          abortController.abort();
        }
      } catch (abortError) {
        console.error(
          "Error aborting sync operation during cleanup:",
          abortError,
        );
      }
    };

    try {
      // Set up a timeout that will abort the operation if it takes too long
      timeoutId = setTimeout(() => {
        try {
          if (isActive && !signal.aborted) {
            console.log("Sync operation timed out, aborting...");
            abortController.abort();

            // Update UI to show error if still active
            if (isActive) {
              setSyncStatus("error");
            }
          }
        } catch (abortError) {
          console.error("Error aborting sync operation:", abortError);
        }
      }, 15000); // 15 second timeout

      try {
        // Start the sync operation
        const result = await syncFromSupabase(leituristaId);

        // Clear the timeout since the operation completed
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Only update UI if the component is still active
        if (isActive) {
          // Update UI based on sync result
          if (result.success) {
            setSyncStatus("completed");
          } else {
            setSyncStatus("error");
          }

          // Update last sync time
          try {
            const currentTime = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            if (isActive) {
              setLastSyncTime(currentTime);
            }
          } catch (timeError) {
            console.error("Error updating sync time:", timeError);
          }
        }
      } catch (error) {
        // Clear the timeout since the operation completed (with an error)
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        console.error("Sync error:", error);

        // Only update UI if the component is still active
        if (isActive) {
          setSyncStatus("error");

          // Ensure we update the UI even if there's an error
          try {
            const currentTime = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            setLastSyncTime(currentTime);
          } catch (timeError) {
            console.error("Error updating sync time after error:", timeError);
          }
        }
      }
    } catch (outerError) {
      console.error("Unexpected error in sync handler:", outerError);

      // Only update UI if the component is still active
      if (isActive) {
        setSyncStatus("error");
      }
    } finally {
      // Make sure we abort the controller if it hasn't been aborted yet
      try {
        if (isActive && !signal.aborted) {
          abortController.abort();
        }
      } catch (finalAbortError) {
        console.error("Error in final abort:", finalAbortError);
      }
    }

    // Return the cleanup function that can be used if the component unmounts during sync
    return cleanup;
  };

  // Function to handle evening sync (upload from SQLite to Supabase)
  const handleEveningSync = async () => {
    // Update daily stats before syncing
    await loadDailyStats();
    // Also refresh routes data
    await loadRoutesForLeiturista();
    if (!isOnline) {
      return; // Can't sync when offline
    }

    // Create an abort controller for this sync operation
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Start sync process
    setSyncStatus("uploading");

    // Use a flag to track if the component is still active during this operation
    let isActive = true;
    // Store timeout ID in a higher scope for reliable cleanup
    let timeoutId: NodeJS.Timeout | null = null;

    // Create a cleanup function that can be called from multiple places
    const cleanup = () => {
      // Mark as inactive first
      isActive = false;

      // Clear any pending timeout
      if (timeoutId !== null) {
        try {
          clearTimeout(timeoutId);
          timeoutId = null;
        } catch (clearError) {
          console.error("Error clearing timeout during cleanup:", clearError);
        }
      }

      // Abort any pending operations
      try {
        if (!signal.aborted) {
          abortController.abort();
        }
      } catch (abortError) {
        console.error(
          "Error aborting sync operation during cleanup:",
          abortError,
        );
      }
    };

    try {
      // Set up a timeout that will abort the operation if it takes too long
      timeoutId = setTimeout(() => {
        try {
          if (isActive && !signal.aborted) {
            console.log("Sync operation timed out, aborting...");
            abortController.abort();

            // Update UI to show error if still active
            if (isActive) {
              setSyncStatus("error");
            }
          }
        } catch (abortError) {
          console.error("Error aborting sync operation:", abortError);
        }
      }, 15000); // 15 second timeout

      try {
        // Start the sync operation
        const result = await syncToSupabase();

        // Clear the timeout since the operation completed
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Only update UI if the component is still active
        if (isActive) {
          // Update UI based on sync result
          if (result.success) {
            setSyncStatus("completed");
            // Update pending uploads count
            try {
              const pendingReadings = await getPendingReadings();
              if (isActive) {
                setPendingUploads(
                  pendingReadings.filter((r) => r.syncStatus === "pending")
                    .length,
                );
              }
            } catch (countError) {
              console.error("Error updating pending count:", countError);
            }
          } else {
            setSyncStatus("error");
          }

          // Update last sync time
          try {
            const currentTime = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            if (isActive) {
              setLastSyncTime(currentTime);
            }
          } catch (timeError) {
            console.error("Error updating sync time:", timeError);
          }
        }
      } catch (error) {
        // Clear the timeout since the operation completed (with an error)
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        console.error("Sync error:", error);

        // Only update UI if the component is still active
        if (isActive) {
          setSyncStatus("error");

          // Ensure we update the UI even if there's an error
          try {
            const currentTime = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            setLastSyncTime(currentTime);
          } catch (timeError) {
            console.error("Error updating sync time after error:", timeError);
          }
        }
      }
    } catch (outerError) {
      console.error("Unexpected error in sync handler:", outerError);

      // Only update UI if the component is still active
      if (isActive) {
        setSyncStatus("error");
      }
    } finally {
      // Make sure we abort the controller if it hasn't been aborted yet
      try {
        if (isActive && !signal.aborted) {
          abortController.abort();
        }
      } catch (finalAbortError) {
        console.error("Error in final abort:", finalAbortError);
      }
    }

    // Return the cleanup function that can be used if the component unmounts during sync
    return cleanup;
  };

  // Legacy sync function, now uses syncToSupabase
  const handleSyncPress = async () => {
    if (!isOnline) {
      return; // Can't sync when offline
    }

    // Create an abort controller for this sync operation
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Start sync process
    setSyncStatus("syncing");

    // Use a flag to track if the component is still active during this operation
    let isActive = true;
    // Store timeout ID in a higher scope for reliable cleanup
    let timeoutId: NodeJS.Timeout | null = null;

    // Create a cleanup function that can be called from multiple places
    const cleanup = () => {
      // Mark as inactive first
      isActive = false;

      // Clear any pending timeout
      if (timeoutId !== null) {
        try {
          clearTimeout(timeoutId);
          timeoutId = null;
        } catch (clearError) {
          console.error("Error clearing timeout during cleanup:", clearError);
        }
      }

      // Abort any pending operations
      try {
        if (!signal.aborted) {
          abortController.abort();
        }
      } catch (abortError) {
        console.error(
          "Error aborting sync operation during cleanup:",
          abortError,
        );
      }
    };

    try {
      // Set up a timeout that will abort the operation if it takes too long
      timeoutId = setTimeout(() => {
        try {
          if (isActive && !signal.aborted) {
            console.log("Sync operation timed out, aborting...");
            abortController.abort();

            // Update UI to show error if still active
            if (isActive) {
              setSyncStatus("error");
            }
          }
        } catch (abortError) {
          console.error("Error aborting sync operation:", abortError);
        }
      }, 10000); // 10 second timeout (reduced from 15s)

      try {
        // Use a more reliable approach with Promise.resolve and error boundaries
        const syncPromise = new Promise<{
          success: boolean;
          syncedCount: number;
          errorCount: number;
        }>((resolve) => {
          // Only proceed if still active
          if (isActive && !signal.aborted) {
            // Wrap in try-catch to handle any synchronous errors
            try {
              // Start the sync operation
              syncPendingReadings()
                .then((result) => {
                  if (isActive) {
                    resolve(result);
                  } else {
                    resolve({ success: false, syncedCount: 0, errorCount: -2 });
                  }
                })
                .catch((syncError) => {
                  console.error("Sync operation failed:", syncError);
                  resolve({ success: false, syncedCount: 0, errorCount: -1 });
                });
            } catch (syncStartError) {
              console.error("Error starting sync operation:", syncStartError);
              resolve({ success: false, syncedCount: 0, errorCount: -1 });
            }
          } else {
            resolve({ success: false, syncedCount: 0, errorCount: -2 }); // Aborted
          }
        });

        // Add a timeout to the promise
        const timeoutPromise = new Promise<{
          success: boolean;
          syncedCount: number;
          errorCount: number;
        }>((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve({ success: false, syncedCount: 0, errorCount: -3 }); // Timeout
          }, 8000); // 8 second timeout for the promise itself

          // Clean up the timeout if aborted
          signal.addEventListener("abort", () => {
            clearTimeout(timeoutId);
            resolve({ success: false, syncedCount: 0, errorCount: -2 }); // Aborted
          });
        });

        // Race the sync promise against the timeout
        const result = await Promise.race([syncPromise, timeoutPromise]);

        // Clear the timeout since the operation completed
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Only update UI if the component is still active
        if (isActive) {
          // Update UI based on sync result
          if (result.success) {
            setSyncStatus("completed");
            // Update pending uploads count
            try {
              const pendingReadings = await getPendingReadings();
              if (isActive) {
                setPendingUploads(
                  pendingReadings.filter((r) => r.syncStatus === "pending")
                    .length,
                );
              }
            } catch (countError) {
              console.error("Error updating pending count:", countError);
              // Don't change the status on this error
            }
          } else {
            setSyncStatus("error");
          }

          // Update last sync time
          try {
            const currentTime = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            if (isActive) {
              setLastSyncTime(currentTime);
            }
          } catch (timeError) {
            console.error("Error updating sync time:", timeError);
            // Continue despite this error
          }
        }
      } catch (error) {
        // Clear the timeout since the operation completed (with an error)
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        console.error("Sync error:", error);

        // Only update UI if the component is still active
        if (isActive) {
          setSyncStatus("error");

          // Ensure we update the UI even if there's an error
          try {
            const currentTime = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            setLastSyncTime(currentTime);
          } catch (timeError) {
            console.error("Error updating sync time after error:", timeError);
          }
        }
      }
    } catch (outerError) {
      console.error("Unexpected error in sync handler:", outerError);

      // Only update UI if the component is still active
      if (isActive) {
        setSyncStatus("error");
      }
    } finally {
      // Make sure we abort the controller if it hasn't been aborted yet
      try {
        if (isActive && !signal.aborted) {
          abortController.abort();
        }
      } catch (finalAbortError) {
        console.error("Error in final abort:", finalAbortError);
      }
    }

    // Return the cleanup function that can be used if the component unmounts during sync
    return cleanup;
  };

  const handleCheckSync = async () => {
    // Check pending readings
    const pendingReadings = await getPendingReadings();
    setPendingUploads(
      pendingReadings.filter((r) => r.syncStatus === "pending").length,
    );

    // Update daily stats
    await loadDailyStats();

    // Refresh routes data
    await loadRoutesForLeiturista();

    // Try to sync if online
    if (isOnline && pendingReadings.length > 0) {
      handleSyncPress();
    }
  };

  // Check if it's morning or evening and perform appropriate sync
  const handleTimeBasedSync = async () => {
    const currentHour = new Date().getHours();

    // Morning sync (download data) - between 6 AM and 10 AM
    if (currentHour >= 6 && currentHour < 10) {
      console.log("Executando sincronização matinal (download de dados)");
      await handleMorningSync();
    }
    // Evening sync (upload data) - between 5 PM and 8 PM
    else if (currentHour >= 17 && currentHour < 20) {
      console.log("Executando sincronização noturna (upload de leituras)");
      await handleEveningSync();
    }
    // Regular sync during the day
    else {
      console.log("Executando sincronização regular");
      await handleSyncPress();
    }
  };

  const handleNotificationsPress = () => {
    // Navigate to notifications or show notifications panel
    console.log("Notifications pressed");
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <Header title="Painel Principal" isOnline={isOnline} />

      <SyncStatusBar
        isOnline={isOnline}
        lastSyncTime={lastSyncTime}
        pendingUploads={pendingUploads}
        onSyncPress={handleTimeBasedSync}
      />

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Notifications Banner */}
        {pendingUploads > 0 && (
          <TouchableOpacity
            className="bg-amber-100 border border-amber-300 rounded-lg p-3 mb-4 flex-row items-center justify-between"
            onPress={handleNotificationsPress}
          >
            <View className="flex-row items-center">
              <Bell size={18} color="#d97706" />
              <Text className="ml-2 text-amber-800">
                {pendingUploads} leituras pendentes para sincronizar
              </Text>
            </View>
            <Text className="text-amber-600 font-medium">Ver</Text>
          </TouchableOpacity>
        )}

        {/* Welcome Message */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-gray-800">
            Olá, Leiturista
          </Text>
          <Text className="text-gray-600">
            Bem-vindo ao seu painel de controle
          </Text>
        </View>

        {/* Dashboard Menu */}
        <DashboardMenu onCheckSync={handleCheckSync} />

        {/* Daily Stats Summary */}
        <View className="bg-white rounded-lg shadow-sm p-4 my-4">
          <Text className="text-lg font-semibold mb-3 text-gray-800">
            Resumo do Dia
          </Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">
                {dailyStats.totalReadings}
              </Text>
              <Text className="text-sm text-gray-600">Leituras Totais</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {dailyStats.completedReadings}
              </Text>
              <Text className="text-sm text-gray-600">Completadas</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-amber-600">
                {dailyStats.pendingReadings}
              </Text>
              <Text className="text-sm text-gray-600">Pendentes</Text>
            </View>
          </View>
        </View>

        {/* Routes List */}
        <View className="mb-4">
          <RoutesList
            routes={routes}
            isLoading={routesLoading}
            onRefresh={loadRoutesForLeiturista}
          />
          {routesError && (
            <View className="bg-red-100 p-3 rounded-md mt-2">
              <Text className="text-red-700">{routesError}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
