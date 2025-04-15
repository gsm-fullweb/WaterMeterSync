import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

// Get Supabase URL and anon key from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// Helper function to check network connectivity
export const checkNetworkConnectivity = async () => {
  try {
    const netInfo = await NetInfo.fetch();
    return {
      isConnected: netInfo.isConnected,
      isInternetReachable: netInfo.isInternetReachable,
      type: netInfo.type,
      details: netInfo.details,
    };
  } catch (error) {
    console.warn("Error checking network connectivity:", error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: "unknown",
      details: null,
    };
  }
};

// Create a custom fetch implementation with timeout, retry logic, and proper connection handling
const customFetch = (url: RequestInfo | URL, init?: RequestInit) => {
  // Maximum number of retry attempts
  const MAX_RETRIES = 30; // Increased from 20 to 30 for more resilience

  // Function to perform the fetch with retry logic
  const attemptFetch = (retryCount = 0): Promise<Response> => {
    // Create an AbortController with a timeout
    const controller = new AbortController();
    // Increased timeout to 300 seconds to allow more time for slow connections
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 300 second timeout (increased from 240s)

    // Add the signal to the fetch options
    const fetchOptions = {
      ...init,
      signal: init?.signal ? init.signal : controller.signal,
      keepalive: true, // Attempt to keep connection alive until complete
      // Add additional headers to help with connection stability
      headers: {
        ...(init?.headers || {}),
        Connection: "keep-alive",
        "Keep-Alive": "timeout=1200, max=5000", // Increased timeout from 900s to 1200s and max from 3000 to 5000
        "Cache-Control": "no-cache, no-store, must-revalidate", // Stronger cache prevention
        Pragma: "no-cache",
        Expires: "0", // Added expires header for additional cache control
        "X-Requested-With": "XMLHttpRequest", // Identify as AJAX request
        "X-Connection-Type": "mobile-app", // Custom header to identify connection type
      },
    };

    return new Promise<Response>((resolve, reject) => {
      // Wrap the fetch in a try-catch to handle synchronous errors
      try {
        // Add debugging logs before making the request
        console.log(
          `[customFetch] Attempting request to: ${typeof url === "string" ? url : url.toString()}`,
        );
        console.log(
          `[customFetch] Headers:`,
          JSON.stringify(fetchOptions?.headers || {}),
        );
        console.log(`[customFetch] Method:`, fetchOptions?.method || "GET");

        // Log request body size if present (but not the actual content for security)
        if (fetchOptions?.body) {
          const bodySize =
            typeof fetchOptions.body === "string"
              ? fetchOptions.body.length
              : "unknown";
          console.log(`[customFetch] Request body size: ${bodySize} bytes`);
        }

        fetch(url, fetchOptions)
          .then((response) => {
            clearTimeout(timeoutId);
            console.log(
              `[customFetch] Response received: ${response.status} ${response.statusText}`,
            );
            resolve(response);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            console.log(
              `[customFetch] Fetch error: ${error?.message || error}`,
            );
            console.log(
              `[customFetch] Error name: ${error?.name || "unknown"}`,
            );
            console.log(
              `[customFetch] Error code: ${error?.code || "unknown"}`,
            );
            // Handle premature close errors more gracefully
            if (error) {
              // Check for all possible network-related error patterns
              const errorString = error.toString().toLowerCase();
              const errorMessage = error.message?.toLowerCase() || "";
              const isNetworkError =
                errorMessage.includes("premature close") ||
                errorMessage.includes("network") ||
                errorMessage.includes("connection") ||
                errorMessage.includes("timeout") ||
                errorMessage.includes("abort") ||
                errorString.includes("networkerror") ||
                errorString.includes("network error") ||
                error.name === "AbortError" ||
                error.name === "TimeoutError" ||
                error.code === "ECONNRESET" ||
                error.code === "ETIMEDOUT" ||
                error.code === "ENOTFOUND" ||
                error.code === "ENETUNREACH" ||
                // Additional error patterns to catch more network issues
                errorMessage.includes("failed to fetch") ||
                errorMessage.includes("network request failed") ||
                errorMessage.includes("socket hang up") ||
                errorMessage.includes("network down") ||
                errorMessage.includes("unexpected end of stream") ||
                errorMessage.includes("unexpected end of file") ||
                errorMessage.includes("unexpected eof") ||
                errorString.includes("fetch failed") ||
                errorString.includes("premature close") ||
                errorMessage.includes("premature close") ||
                error.code === "ECONNABORTED" ||
                error.code === "ECONNREFUSED" ||
                // Additional patterns specifically for premature close
                errorMessage.includes("end of stream") ||
                errorMessage.includes("end of file") ||
                errorMessage.includes("stream ended") ||
                errorMessage.includes("connection closed") ||
                errorMessage.includes("connection terminated") ||
                errorMessage.includes("connection reset") ||
                errorMessage.includes("connection aborted") ||
                errorMessage.includes("connection refused") ||
                errorMessage.includes("connection failed") ||
                errorMessage.includes("socket closed") ||
                errorMessage.includes("socket error") ||
                errorMessage.includes("socket hang up") ||
                errorMessage.includes("socket timeout") ||
                errorMessage.includes("socket ended") ||
                errorMessage.includes("socket reset") ||
                errorMessage.includes("socket aborted") ||
                errorMessage.includes("socket refused") ||
                errorMessage.includes("socket failed") ||
                // Additional patterns for more comprehensive error detection
                errorMessage.includes("request failed") ||
                errorMessage.includes("request timed out") ||
                errorMessage.includes("request aborted") ||
                errorMessage.includes("request cancelled") ||
                errorMessage.includes("request interrupted") ||
                errorMessage.includes("connection lost") ||
                errorMessage.includes("connection dropped") ||
                errorMessage.includes("connection interrupted") ||
                errorMessage.includes("connection unstable") ||
                errorMessage.includes("network unstable") ||
                errorMessage.includes("network dropped") ||
                errorMessage.includes("network lost") ||
                errorMessage.includes("network interrupted");

              // If it's a network error and we haven't exceeded max retries, try again
              if (isNetworkError && retryCount < MAX_RETRIES) {
                // Implement a more gradual backoff strategy for early retries
                let backoffDelay;
                if (retryCount < 5) {
                  // For the first few retries, use a more aggressive retry strategy
                  backoffDelay = Math.min(
                    500 * Math.pow(1.5, retryCount),
                    10000,
                  );
                } else {
                  // For later retries, use standard exponential backoff
                  backoffDelay = Math.min(
                    1000 * Math.pow(2, retryCount - 5),
                    240000, // Increased max backoff to 240s from 180s
                  );
                }
                console.warn(
                  `Network error detected (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying in ${backoffDelay}ms:`,
                  error.message || error.toString(),
                );

                // Wait with exponential backoff before retrying
                return setTimeout(() => {
                  // Check network connectivity before retrying
                  checkNetworkConnectivity()
                    .then((netInfo) => {
                      if (netInfo.isConnected && netInfo.isInternetReachable) {
                        console.log("Network available, retrying request...");
                        resolve(attemptFetch(retryCount + 1));
                      } else {
                        console.warn(
                          "Network unavailable, waiting longer before retry...",
                        );
                        // Wait longer if network is unavailable
                        setTimeout(() => {
                          resolve(attemptFetch(retryCount + 1));
                        }, 5000); // Additional 5s wait
                      }
                    })
                    .catch(() => {
                      // If connectivity check fails, retry anyway
                      resolve(attemptFetch(retryCount + 1));
                    });
                }, backoffDelay);
              }

              if (isNetworkError) {
                console.warn(
                  "Handled network/connection error after retries:",
                  error.message || error.toString(),
                  "\nError name:",
                  error.name,
                  "\nError code:",
                  error.code || "N/A",
                );
                // Create a mock response for network errors
                const mockResponse = new Response(
                  JSON.stringify({
                    error: "Connection issue detected",
                    errorType: error.message || error.toString(),
                    errorName: error.name,
                    errorCode: error.code,
                    recoverable: true,
                    retryAttempts: retryCount,
                    timestamp: new Date().toISOString(),
                  }),
                  {
                    status: 499, // Client closed request status code
                    headers: { "Content-Type": "application/json" },
                  },
                );
                resolve(mockResponse);
                return;
              }
            }

            console.error("Unhandled fetch error:", error);
            reject(error);
          });
      } catch (syncError) {
        // Handle synchronous errors that might occur during fetch initialization
        clearTimeout(timeoutId);
        console.warn("Synchronous error during fetch:", syncError);

        if (retryCount < MAX_RETRIES) {
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 240000); // Increased from 180000 to 240000
          console.warn(
            `Retrying after sync error (attempt ${retryCount + 1}/${MAX_RETRIES}) in ${backoffDelay}ms`,
          );

          setTimeout(() => {
            resolve(attemptFetch(retryCount + 1));
          }, backoffDelay);
        } else {
          // Create a mock response for synchronous errors after max retries
          const mockResponse = new Response(
            JSON.stringify({
              error: "Synchronous fetch error",
              errorType: syncError.toString(),
              recoverable: false,
              retryAttempts: retryCount,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 499,
              headers: { "Content-Type": "application/json" },
            },
          );
          resolve(mockResponse);
        }
      }
    });
  };

  // Start the fetch process with retry logic
  return attemptFetch();
};

// Create a connection state manager to track and recover from connection issues
class ConnectionStateManager {
  // Add event listeners for app state and network changes
  private static instance: ConnectionStateManager | null = null;

  // Singleton pattern to ensure only one instance exists
  public static getInstance(): ConnectionStateManager {
    if (!ConnectionStateManager.instance) {
      ConnectionStateManager.instance = new ConnectionStateManager();
    }
    return ConnectionStateManager.instance;
  }
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 60; // Increased from 40 to 60
  private lastNetworkCheck = 0;
  private networkCheckInterval = 1000; // Reduced from 2 seconds to 1 second for more frequent checks

  constructor() {
    // Initialize with a network check
    this.checkNetworkAndRecover();

    // Set up periodic network checks
    setInterval(() => this.checkNetworkAndRecover(), this.networkCheckInterval);
  }

  private async checkNetworkAndRecover() {
    const now = Date.now();
    if (now - this.lastNetworkCheck < this.networkCheckInterval) return;

    this.lastNetworkCheck = now;
    const netInfo = await checkNetworkConnectivity();

    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      console.warn(
        "Network connectivity issues detected, will retry connections when network is available",
        netInfo,
      );
      this.isReconnecting = true;

      // Schedule more frequent checks when disconnected
      setTimeout(() => this.checkNetworkAndRecover(), 250); // Reduced from 500ms to 250ms
    } else if (this.isReconnecting) {
      console.log("Network connectivity restored, reconnecting...");
      this.isReconnecting = false;
      this.reconnectAttempts = 0;

      // Force reconnect by recreating the Supabase client
      try {
        // We can't actually recreate the client here, but we can log that we would
        console.log("Would reconnect Supabase client if possible");
      } catch (error) {
        console.error("Error during reconnection attempt:", error);
      }
    }
  }

  public shouldRetry(): boolean {
    return this.reconnectAttempts < this.maxReconnectAttempts;
  }

  public recordReconnectAttempt() {
    this.reconnectAttempts++;
    return this.reconnectAttempts;
  }

  public resetReconnectAttempts() {
    this.reconnectAttempts = 0;
  }
}

// Initialize the connection state manager as a singleton
const connectionManager = ConnectionStateManager.getInstance();

// Create Supabase client with custom fetch options to prevent hanging connections
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "supabase-auth-token",
    storage: {
      // Add more robust error handling for storage operations
      getItem: async (key: string) => {
        try {
          const item = await AsyncStorage.getItem(key);
          return item;
        } catch (error) {
          console.warn("Error retrieving auth from storage:", error);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await AsyncStorage.setItem(key, value);
        } catch (error) {
          console.warn("Error saving auth to storage:", error);
        }
      },
      removeItem: async (key: string) => {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          console.warn("Error removing auth from storage:", error);
        }
      },
    },
  },
  global: {
    fetch: customFetch,
  },
  realtime: {
    timeout: 480000, // 480 seconds timeout for realtime connections (increased from 360s)
    params: {
      eventsPerSecond: 0.02, // Further reduced from 0.05 to 0.02 to minimize connection stress
    },
    // Add additional realtime options to improve stability
    autoConnectWithAuth: true,
    disconnectOnTabHidden: false,
    reconnectWithAuth: true,
  },
  // Add additional options for socket connections
  socket: {
    reconnectAfterMs: (attempt) => {
      // Exponential backoff with jitter to prevent thundering herd
      const baseDelay = Math.min(1000 * Math.pow(2, attempt), 420000); // Increased max to 420s from 300s
      const jitter = Math.random() * 12000; // Increased jitter from 8s to 12s
      return baseDelay + jitter;
    },
    timeout: 480000, // Increased from 360s to 480s
    heartbeatIntervalMs: 15000, // Decreased from 20s to 15s for more frequent heartbeats
  },
  // Add additional options to help with connection stability
  db: {
    schema: "public",
  },
  // Reduce concurrent requests to avoid overwhelming the connection
  headers: {
    "X-Client-Info": "expo-app",
    Connection: "keep-alive",
    "Keep-Alive": "timeout=1200, max=1200", // Increased timeout from 900s to 1200s and max from 800 to 1200
    "Cache-Control": "no-cache, no-store, must-revalidate", // Stronger cache prevention
    Pragma: "no-cache",
    Expires: "0", // Added expires header for additional cache control
  },
  // Add retry configuration with exponential backoff
  retryAttempts: 35, // Increased from 25 to 35 to handle more transient failures
  retryInterval: (attempt) => {
    // Exponential backoff with jitter to prevent thundering herd
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 420000); // Increased max to 420s from 300s
    const jitter = Math.random() * 20000; // Increased jitter from 15s to 20s
    return baseDelay + jitter;
  },
});
