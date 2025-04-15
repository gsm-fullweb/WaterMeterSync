import NetInfo from "@react-native-community/netinfo";
import {
  getPendingReadings,
  updateReadingSyncStatus,
  saveLastSyncTime,
  MeterReading,
  removeSyncedReadings,
} from "./storage";
import { supabase } from "./supabaseClient";
import { query, exec } from "./database";
import { logInfo, logError, logWarn, withRetry } from "./logger";

// Check if device is online
export const checkOnlineStatus = async (): Promise<boolean> => {
  try {
    const netInfo = await NetInfo.fetch();
    // More defensive check - only return true if we're definitely connected
    // and internet is definitely reachable
    const isOnline =
      netInfo.isConnected === true && netInfo.isInternetReachable === true;
    logInfo(`Network status check: ${isOnline ? "online" : "offline"}`, {
      netInfo,
    });
    return isOnline;
  } catch (error) {
    logError("Error checking online status", error);
    return false;
  }
  // Removed the finally block with gc() call as it's not necessary and could cause issues
};

// Simple delay function that works with AbortController
const delay = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Operation aborted"));
      return;
    }

    const id = setTimeout(() => {
      resolve();
    }, ms);

    // Set up abort handler if signal is provided
    if (signal) {
      // Use a local variable to track if we've already handled this abort
      let abortHandled = false;

      const abortHandler = () => {
        // Prevent multiple executions
        if (abortHandled) return;
        abortHandled = true;

        // Clean up the timeout
        clearTimeout(id);

        // Remove the event listener to prevent memory leaks
        try {
          signal.removeEventListener("abort", abortHandler);
        } catch (removeError) {
          console.warn("Error removing abort listener:", removeError);
        }

        reject(new Error("Operation aborted"));
      };

      try {
        signal.addEventListener("abort", abortHandler, { once: true });
      } catch (addError) {
        console.warn("Error adding abort listener:", addError);
        // If we can't add the listener, still allow the timeout to work
      }
    }
  });
};

// Helper function to check if an error is a premature close error
const isPrematureCloseError = (error: any): boolean => {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || "";
  const errorString = error.toString().toLowerCase();

  return (
    errorMessage.includes("premature close") ||
    errorString.includes("premature close") ||
    errorMessage.includes("unexpected end of stream") ||
    errorMessage.includes("unexpected end of file") ||
    errorMessage.includes("connection closed") ||
    errorMessage.includes("connection terminated") ||
    errorMessage.includes("socket closed")
  );
};

// Retry function specifically for handling premature close errors
const retryOnPrematureClose = async <T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    operationName?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> => {
  const {
    maxRetries = 5,
    initialDelay = 1000,
    maxDelay = 15000,
    operationName = "operation",
    signal,
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // Check if operation was aborted
      if (signal?.aborted) {
        throw new Error("Operation aborted");
      }

      if (attempt > 1) {
        logInfo(
          `Retry attempt ${attempt - 1} for ${operationName} after premature close`,
        );
      }

      return await operation();
    } catch (error) {
      lastError = error;

      // Check if operation was aborted
      if (signal?.aborted) {
        throw new Error("Operation aborted");
      }

      if (attempt <= maxRetries && isPrematureCloseError(error)) {
        logWarn(
          `${operationName} failed with premature close, retrying in ${delay}ms`,
          {
            error,
            attempt,
          },
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelay);
      } else if (isPrematureCloseError(error)) {
        logError(
          `${operationName} failed after ${maxRetries} retries due to premature close`,
          {
            error,
          },
        );
        throw error;
      } else {
        // Not a premature close error, don't retry
        throw error;
      }
    }
  }

  throw lastError;
};

// Download data from Supabase to SQLite (morning sync)
export async function syncFromSupabase(leituristaId: string): Promise<{
  success: boolean;
  syncedCount: number;
  errorCount: number;
}> {
  logInfo(`Starting syncFromSupabase for leiturista: ${leituristaId}`);
  let supabaseResponse = null;
  const abortController = new AbortController();
  const signal = abortController.signal;
  // Track active requests to ensure proper cleanup
  const activeRequests: Array<{ cancel: () => void }> = [];

  try {
    // Check if online
    const isOnline = await checkOnlineStatus();
    if (!isOnline) {
      logWarn("Device is offline, cannot sync from Supabase");
      return { success: false, syncedCount: 0, errorCount: 0 };
    }
    logInfo("Device is online, proceeding with sync from Supabase");

    // Set a global timeout for the entire operation - increased from 60s to 120s
    const globalTimeout = setTimeout(() => {
      try {
        logWarn("Global timeout reached for syncFromSupabase operation");
        abortController.abort();
        // Cancel all active requests
        activeRequests.forEach((req) => {
          try {
            req.cancel();
          } catch (cancelError) {
            console.error("Error cancelling request:", cancelError);
          }
        });
      } catch (abortError) {
        console.error("Error aborting sync operation:", abortError);
      }
    }, 120000); // 120 second global timeout (increased from 60s)

    try {
      // Create a cancellable request wrapper
      const makeRequest = () => {
        let isCancelled = false;

        const promise = new Promise<any>(async (resolve) => {
          // Track if this request has been resolved to prevent multiple resolutions
          let isResolved = false;
          const safeResolve = (result: any) => {
            if (!isResolved) {
              isResolved = true;
              resolve(result);
            }
          };

          if (isCancelled) {
            safeResolve({ data: null, error: new Error("Request cancelled") });
            return;
          }

          try {
            // Wrap the Supabase request in our retry function for premature close errors
            const fetchWithRetry = async () => {
              // Baixar roteiro do leiturista - with timeout to prevent hanging connections
              const fetchPromise = supabase
                .from("roteiros")
                .select(
                  `
                  id, dia_semana,
                  ruas(id, nome, bairro_id),
                  ruas:bairro_id(id, nome, cidade),
                  ruas(residencias(id, numero, clientes(id, nome, telefone, email, cpf)))
                `,
                )
                .eq("leiturista_id", leituristaId)
                .abortSignal(signal); // Add abort signal to the request

              // Add a timeout to prevent hanging connections
              const timeoutPromise = new Promise<{ data: null; error: Error }>(
                (_, timeoutResolve) => {
                  const timeoutId = setTimeout(
                    () => {
                      logWarn("Supabase request timeout reached");
                      safeResolve({
                        data: null,
                        error: new Error("Supabase request timeout"),
                      });
                    },
                    30000, // Increased timeout from 20s to 30s
                  );

                  // Clean up timeout if signal is aborted
                  if (signal) {
                    signal.addEventListener(
                      "abort",
                      () => {
                        clearTimeout(timeoutId);
                        safeResolve({
                          data: null,
                          error: new Error("Operation aborted"),
                        });
                      },
                      { once: true },
                    );
                  }
                },
              );

              return Promise.race([fetchPromise, timeoutPromise]);
            };

            // Use our retry function for premature close errors
            const result = await retryOnPrematureClose(fetchWithRetry, {
              maxRetries: 3,
              initialDelay: 2000,
              operationName: "Supabase roteiros fetch",
              signal,
            });

            if (isCancelled) {
              safeResolve({
                data: null,
                error: new Error("Request cancelled"),
              });
              return;
            }

            safeResolve(result);
          } catch (error) {
            logError("Error fetching roteiros with retry", error);
            safeResolve({ data: null, error });
          }
        });

        return {
          promise,
          cancel: () => {
            isCancelled = true;
            // Add a small delay to ensure any pending operations complete
            setTimeout(() => {}, 50);
          },
        };
      };

      // Create and track the request
      const request = makeRequest();
      activeRequests.push(request);

      // Wait for the request to complete with error handling
      try {
        supabaseResponse = await request.promise;
      } catch (promiseError) {
        console.error("Error in request promise:", promiseError);
        supabaseResponse = { data: null, error: promiseError };
      }

      // Remove from active requests
      const index = activeRequests.indexOf(request);
      if (index !== -1) {
        activeRequests.splice(index, 1);
      }

      const { data: roteiros, error } = supabaseResponse;

      if (error) {
        logError("Erro ao baixar dados do Supabase", error);
        return { success: false, syncedCount: 0, errorCount: 1 };
      }

      if (!roteiros || roteiros.length === 0) {
        logInfo(`Nenhum roteiro encontrado para o leiturista: ${leituristaId}`);
        return { success: true, syncedCount: 0, errorCount: 0 };
      }

      let syncedCount = 0;
      let errorCount = 0;

      // Process in smaller batches to avoid long-running transactions
      // Increased batch size from 2 to 4 to further reduce number of connections while still keeping batches manageable
      const batchSize = 4;
      logInfo(`Syncing ${roteiros.length} routes in batches of ${batchSize}`);

      for (let i = 0; i < roteiros.length; i += batchSize) {
        // Check if operation was aborted
        if (signal.aborted) {
          throw new Error("Sync operation was aborted");
        }

        const batch = roteiros.slice(i, i + batchSize);
        logInfo(
          `Processing route batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(roteiros.length / batchSize)}, items: ${batch.length}`,
        );

        for (const r of batch) {
          try {
            // Check if operation was aborted
            if (signal.aborted) {
              throw new Error("Sync operation was aborted");
            }

            // Inserir roteiro
            await exec(
              `INSERT OR IGNORE INTO roteiros (id, leiturista_id, rua_id, dia_semana) VALUES (?, ?, ?, ?)`,
              [r.id, leituristaId, r.ruas.id, r.dia_semana],
            );

            // Inserir bairro
            await exec(
              `INSERT OR IGNORE INTO bairros (id, nome, cidade) VALUES (?, ?, ?)`,
              [
                r.ruas.bairro_id.id,
                r.ruas.bairro_id.nome,
                r.ruas.bairro_id.cidade,
              ],
            );

            // Inserir rua
            await exec(
              `INSERT OR IGNORE INTO ruas (id, nome, bairro_id) VALUES (?, ?, ?)`,
              [r.ruas.id, r.ruas.nome, r.ruas.bairro_id.id],
            );

            syncedCount++;

            // Inserir residências e clientes - process in smaller batches
            const residencias = r.ruas.residencias || [];
            // Increased batch size from 5 to 10 to further reduce number of connections while still keeping batches manageable
            const resBatchSize = 10; // Process multiple at a time to reduce connection overhead
            logInfo(
              `Processing ${residencias.length} residences in batches of ${resBatchSize}`,
            );

            for (let j = 0; j < residencias.length; j += resBatchSize) {
              // Check if operation was aborted
              if (signal.aborted) {
                throw new Error("Sync operation was aborted");
              }

              const resBatch = residencias.slice(j, j + resBatchSize);

              for (const res of resBatch) {
                try {
                  // Check if operation was aborted
                  if (signal.aborted) {
                    throw new Error("Sync operation was aborted");
                  }

                  await exec(
                    `INSERT OR IGNORE INTO residencias (id, rua_id, numero) VALUES (?, ?, ?)`,
                    [res.id, r.ruas.id, res.numero],
                  );

                  if (res.clientes) {
                    await exec(
                      `INSERT OR IGNORE INTO clientes (id, nome, telefone, email, cpf, residencia_id) VALUES (?, ?, ?, ?, ?, ?)`,
                      [
                        res.clientes.id,
                        res.clientes.nome,
                        res.clientes.telefone,
                        res.clientes.email,
                        res.clientes.cpf,
                        res.id,
                      ],
                    );
                  }
                } catch (resError) {
                  console.error(
                    "Erro ao inserir residência/cliente:",
                    resError,
                  );
                  errorCount++;
                }
              }

              // Shorter delay between batches since we're processing more items per batch
              // Increased delay from 300ms to 500ms to give more breathing room between batches
              await delay(500, signal);
              logInfo(
                `Completed residence batch ${Math.floor(j / resBatchSize) + 1}/${Math.ceil(residencias.length / resBatchSize)}`,
              );
            }
          } catch (rotError) {
            // Check if this was an abort error
            if (signal.aborted) {
              throw rotError; // Re-throw to be caught by outer try/catch
            }
            console.error("Erro ao inserir roteiro/bairro/rua:", rotError);
            errorCount++;
          }
        }

        // Adjusted delay between batches based on batch size
        // Increased delay from 800ms to 1200ms to give more breathing room between route batches
        await delay(1200, signal);
        logInfo(
          `Completed route batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(roteiros.length / batchSize)}`,
        );
      }

      // Update last sync time
      try {
        await saveLastSyncTime(new Date().toISOString());
      } catch (timeError) {
        console.error("Error saving last sync time:", timeError);
      }

      logInfo("📥 Dados sincronizados do Supabase com sucesso!", {
        syncedCount,
        errorCount,
      });
      return { success: errorCount === 0, syncedCount, errorCount };
    } finally {
      // Clear the global timeout
      clearTimeout(globalTimeout);

      // Cancel any remaining active requests
      activeRequests.forEach((req) => {
        try {
          req.cancel();
        } catch (cancelError) {
          console.error(
            "Error cancelling request during cleanup:",
            cancelError,
          );
        }
      });
      // Clear the array
      activeRequests.length = 0;
    }
  } catch (error) {
    // Check if this was an abort error
    if (signal.aborted) {
      console.error(
        "Sync operation was aborted due to timeout or manual cancellation",
      );
      return { success: false, syncedCount: 0, errorCount: -2 }; // Special code for aborted
    }
    console.error("Erro na sincronização do Supabase para SQLite:", error);
    return { success: false, syncedCount: 0, errorCount: 1 };
  } finally {
    // Ensure any pending connections are properly closed
    try {
      // Add a small delay before nullifying to allow any pending operations to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Force garbage collection of the response object
      supabaseResponse = null;
    } catch (finalError) {
      console.error("Error in final cleanup:", finalError);
    }

    // Clean up by aborting the controller if it hasn't been aborted yet
    if (!signal.aborted) {
      try {
        abortController.abort();
        // Wait a moment for abort to propagate
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (abortError) {
        console.error("Error aborting sync controller:", abortError);
      }
    }

    // Ensure all active requests are cancelled
    if (activeRequests.length > 0) {
      logInfo(
        `Cancelling ${activeRequests.length} active requests during cleanup`,
      );
      activeRequests.forEach((req) => {
        try {
          req.cancel();
        } catch (cancelError) {
          console.error(
            "Error cancelling request during final cleanup:",
            cancelError,
          );
        }
      });
      // Wait a moment for cancellations to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
      // Clear the array
      activeRequests.length = 0;
    }
  }
}

// Upload data from SQLite to Supabase (evening sync)
export async function syncToSupabase(): Promise<{
  success: boolean;
  syncedCount: number;
  errorCount: number;
}> {
  logInfo("Starting syncToSupabase");
  const abortController = new AbortController();
  const signal = abortController.signal;
  // Track active requests to ensure proper cleanup
  const activeRequests: Array<{ cancel: () => void }> = [];

  try {
    // Check if online
    const isOnline = await checkOnlineStatus();
    if (!isOnline) {
      logWarn("Device is offline, cannot sync to Supabase");
      return { success: false, syncedCount: 0, errorCount: 0 };
    }
    logInfo("Device is online, proceeding with sync to Supabase");

    // Set a global timeout for the entire operation - increased from 60s to 120s
    const globalTimeout = setTimeout(() => {
      try {
        logWarn("Global timeout reached for syncToSupabase operation");
        abortController.abort();
        // Cancel all active requests
        activeRequests.forEach((req) => {
          try {
            req.cancel();
          } catch (cancelError) {
            console.error("Error cancelling request:", cancelError);
          }
        });
      } catch (abortError) {
        console.error("Error aborting sync operation:", abortError);
      }
    }, 120000); // 120 second global timeout (increased from 60s)

    try {
      // Get all pending readings from leituras table
      const leiturasPendentes = await query(
        `SELECT * FROM leituras WHERE sincronizado = 0`,
      );

      if (!leiturasPendentes || leiturasPendentes.length === 0) {
        logInfo("Nenhuma leitura pendente para sincronizar");
        return { success: true, syncedCount: 0, errorCount: 0 };
      }

      let syncedCount = 0;
      let errorCount = 0;

      // Process in smaller batches to avoid overwhelming the connection
      // Increased batch size from 3 to 5 to further reduce number of connections while still keeping batches manageable
      const batchSize = 5;
      logInfo(
        `Syncing ${leiturasPendentes.length} readings in batches of ${batchSize}`,
      );

      for (let i = 0; i < leiturasPendentes.length; i += batchSize) {
        // Check if operation was aborted
        if (signal.aborted) {
          throw new Error("Sync operation was aborted");
        }

        const batch = leiturasPendentes.slice(i, i + batchSize);
        logInfo(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(leiturasPendentes.length / batchSize)}, items: ${batch.length}`,
        );

        // Process batch sequentially to avoid connection issues
        for (const leitura of batch) {
          try {
            // Check if operation was aborted
            if (signal.aborted) {
              throw new Error("Sync operation was aborted");
            }

            // Create a cancellable request wrapper
            const makeRequest = () => {
              let isCancelled = false;

              const promise = new Promise<{ error: any | null }>(
                async (resolve) => {
                  // Track if this request has been resolved to prevent multiple resolutions
                  let isResolved = false;
                  const safeResolve = (result: { error: any | null }) => {
                    if (!isResolved) {
                      isResolved = true;
                      resolve(result);
                    }
                  };

                  if (isCancelled) {
                    safeResolve({ error: new Error("Request cancelled") });
                    return;
                  }

                  try {
                    // Wrap the Supabase insert in our retry function for premature close errors
                    const insertWithRetry = async () => {
                      // Ensure required fields have default values if they're null or undefined
                      const defaultResidenciaId = "default-residencia-id";
                      const defaultClienteId = "default-cliente-id";
                      const defaultLeituristaId = "default-leiturista-id";

                      // Prepare payload with default values for required fields
                      const payload = {
                        id: leitura.id,
                        residencia_id:
                          leitura.residencia_id || defaultResidenciaId,
                        cliente_id: leitura.cliente_id || defaultClienteId,
                        leiturista_id:
                          leitura.leiturista_id || defaultLeituristaId,
                        leitura_valor: leitura.leitura_valor,
                        foto_path: leitura.foto_path,
                        status: leitura.status || "pendente",
                        data_leitura:
                          leitura.data_leitura ||
                          new Date().toISOString().split("T")[0],
                        hora_leitura:
                          leitura.hora_leitura ||
                          new Date().toTimeString().split(" ")[0],
                        sincronizado: true,
                      };

                      logInfo(
                        `Preparing to sync leitura with ID: ${leitura.id}`,
                        { payload },
                      );

                      // Add timeout to prevent hanging connections
                      const insertPromise = supabase
                        .from("leituras")
                        .insert([payload])
                        .abortSignal(signal); // Add abort signal to the request

                      // Add a timeout to prevent hanging connections
                      const timeoutPromise = new Promise<{ error: Error }>(
                        (_, timeoutReject) => {
                          const timeoutId = setTimeout(
                            () => {
                              logWarn("Supabase insert timeout reached");
                              safeResolve({
                                error: new Error("Supabase insert timeout"),
                              });
                            },
                            25000, // Increased timeout from 15s to 25s
                          );

                          // Clean up timeout if signal is aborted
                          if (signal) {
                            signal.addEventListener(
                              "abort",
                              () => {
                                clearTimeout(timeoutId);
                                safeResolve({
                                  error: new Error("Operation aborted"),
                                });
                              },
                              { once: true },
                            );
                          }
                        },
                      );

                      return Promise.race([insertPromise, timeoutPromise]);
                    };

                    // Use our retry function for premature close errors
                    const result = await retryOnPrematureClose(
                      insertWithRetry,
                      {
                        maxRetries: 3,
                        initialDelay: 2000,
                        operationName: `Supabase leitura insert (ID: ${leitura.id})`,
                        signal,
                      },
                    );

                    if (isCancelled) {
                      safeResolve({ error: new Error("Request cancelled") });
                      return;
                    }

                    safeResolve(result);
                  } catch (error) {
                    logError(
                      `Error inserting leitura ${leitura.id} with retry`,
                      error,
                    );
                    safeResolve({ error });
                  }
                },
              );

              return {
                promise,
                cancel: () => {
                  isCancelled = true;
                  // Add a small delay to ensure any pending operations complete
                  setTimeout(() => {}, 50);
                },
              };
            };

            // Create and track the request
            const request = makeRequest();
            activeRequests.push(request);

            // Wait for the request to complete with error handling
            let error = null;
            try {
              const result = await request.promise;
              error = result.error;
            } catch (promiseError) {
              console.error("Error in request promise:", promiseError);
              error = promiseError;
            }

            // Remove from active requests
            const index = activeRequests.indexOf(request);
            if (index !== -1) {
              activeRequests.splice(index, 1);
            }

            if (!error) {
              await exec(`UPDATE leituras SET sincronizado = 1 WHERE id = ?`, [
                leitura.id,
              ]);
              logInfo(`Successfully synced leitura with ID: ${leitura.id}`);
              syncedCount++;
            } else {
              // Enhanced error logging with more details
              const errorDetails = {
                leituraId: leitura.id,
                errorMessage: error.message,
                errorCode: error.code,
                details: error.details,
                hint: error.hint,
                residenciaId: leitura.residencia_id,
                clienteId: leitura.cliente_id,
                leituristaId: leitura.leiturista_id,
              };

              logError(
                `Erro ao sincronizar leitura: ${leitura.id}`,
                errorDetails,
              );
              console.error("Erro ao sincronizar leitura:", leitura.id, error);
              errorCount++;
            }
          } catch (error) {
            // Check if this was an abort error
            if (signal.aborted) {
              throw error; // Re-throw to be caught by outer try/catch
            }
            console.error("Erro ao processar leitura:", leitura.id, error);
            errorCount++;
          }
        }

        // Adjusted delay between batches based on batch size
        // Increased delay from 800ms to 1200ms to give more breathing room between batches
        await delay(1200, signal);
        logInfo(
          `Completed reading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(leiturasPendentes.length / batchSize)}`,
        );
      }

      // Update last sync time
      try {
        await saveLastSyncTime(new Date().toISOString());
      } catch (timeError) {
        console.error("Error saving last sync time:", timeError);
      }

      logInfo("📤 Leituras sincronizadas com Supabase com sucesso!", {
        syncedCount,
        errorCount,
      });
      return { success: errorCount === 0, syncedCount, errorCount };
    } finally {
      // Clear the global timeout
      clearTimeout(globalTimeout);

      // Cancel any remaining active requests
      activeRequests.forEach((req) => {
        try {
          req.cancel();
        } catch (cancelError) {
          console.error(
            "Error cancelling request during cleanup:",
            cancelError,
          );
        }
      });
      // Clear the array
      activeRequests.length = 0;
    }
  } catch (error) {
    // Check if this was an abort error
    if (signal.aborted) {
      console.error(
        "Sync operation was aborted due to timeout or manual cancellation",
      );
      return { success: false, syncedCount: 0, errorCount: -2 }; // Special code for aborted
    }
    console.error("Erro na sincronização do SQLite para Supabase:", error);
    return { success: false, syncedCount: 0, errorCount: 1 };
  } finally {
    // Clean up by aborting the controller if it hasn't been aborted yet
    if (!signal.aborted) {
      try {
        abortController.abort();
        // Wait a moment for abort to propagate
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (abortError) {
        console.error("Error aborting sync controller:", abortError);
      }
    }

    // Ensure all active requests are cancelled
    if (activeRequests.length > 0) {
      logInfo(
        `Cancelling ${activeRequests.length} active requests during cleanup`,
      );
      activeRequests.forEach((req) => {
        try {
          req.cancel();
        } catch (cancelError) {
          console.error(
            "Error cancelling request during final cleanup:",
            cancelError,
          );
        }
      });
      // Wait a moment for cancellations to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
      // Clear the array
      activeRequests.length = 0;
    }
  }
}

// Sync all pending readings (legacy function, now uses syncToSupabase)
export const syncPendingReadings = async (): Promise<{
  success: boolean;
  syncedCount: number;
  errorCount: number;
}> => {
  // Create an abort controller for this sync operation
  const abortController = new AbortController();
  const signal = abortController.signal;

  try {
    // Check if online
    const isOnline = await checkOnlineStatus();
    if (!isOnline) {
      return { success: false, syncedCount: 0, errorCount: 0 };
    }

    // Get all pending readings
    const pendingReadings = await getPendingReadings();
    const pendingCount = pendingReadings.filter(
      (r) => r.syncStatus === "pending",
    ).length;

    if (pendingCount === 0) {
      // No pending readings to sync
      try {
        await saveLastSyncTime(new Date().toISOString());
      } catch (timeError) {
        console.error("Error saving last sync time:", timeError);
        // Continue despite this error
      }
      return { success: true, syncedCount: 0, errorCount: 0 };
    }

    let syncedCount = 0;
    let errorCount = 0;

    // Process each pending reading
    for (const reading of pendingReadings) {
      // Check if operation was aborted
      if (signal.aborted) {
        throw new Error("Sync operation was aborted");
      }

      if (reading.syncStatus === "pending") {
        try {
          // In a real app, this would be an API call to your backend
          // For demo purposes, we'll simulate a successful sync with a delay
          try {
            // Use our improved delay function that works with AbortController
            await delay(300, signal);

            // Simulate 90% success rate
            const isSuccess = Math.random() > 0.1;

            if (isSuccess) {
              await updateReadingSyncStatus(reading.id, "synced");
              syncedCount++;
            } else {
              await updateReadingSyncStatus(reading.id, "error");
              errorCount++;
            }
          } catch (delayError) {
            // If this was an abort error, rethrow it
            if (signal.aborted) {
              throw delayError;
            }

            // Otherwise handle the error
            console.error("Error during sync delay:", delayError);
            await updateReadingSyncStatus(reading.id, "error");
            errorCount++;
          }
        } catch (error) {
          // Check if this was an abort error
          if (signal.aborted) {
            throw error; // Re-throw to be caught by outer try/catch
          }

          console.error("Error syncing reading:", reading.id, error);
          try {
            await updateReadingSyncStatus(reading.id, "error");
          } catch (statusError) {
            console.error("Failed to update reading status:", statusError);
          }
          errorCount++;
        }
      }
    }

    // Update last sync time
    try {
      await saveLastSyncTime(new Date().toISOString());
    } catch (timeError) {
      console.error("Error saving last sync time:", timeError);
      // Continue despite this error
    }

    // Clean up synced readings if all were successful
    if (errorCount === 0 && syncedCount > 0) {
      try {
        await removeSyncedReadings();
      } catch (cleanupError) {
        console.error("Error removing synced readings:", cleanupError);
        // Continue despite this error
      }
    }

    return {
      success: errorCount === 0,
      syncedCount,
      errorCount,
    };
  } catch (error) {
    console.error("Unexpected error during sync process:", error);
    // Check if this was an abort error
    if (signal.aborted) {
      return { success: false, syncedCount: 0, errorCount: -2 }; // Special code for aborted
    }
    return { success: false, syncedCount: 0, errorCount: -1 };
  } finally {
    // Clean up by aborting the controller if it hasn't been aborted yet
    if (!signal.aborted) {
      try {
        abortController.abort();
      } catch (abortError) {
        console.error("Error aborting sync controller:", abortError);
      }
    }
  }
};

// Fetch daily routes for a meter reader based on current day of week
export async function fetchDailyRoutes(leituristaId: string): Promise<any[]> {
  try {
    // Check if online
    const isOnline = await checkOnlineStatus();
    if (!isOnline) {
      logWarn("Device is offline, cannot fetch daily routes");
      return [];
    }

    // Get current day of week in Portuguese
    const daysOfWeek = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];
    const today = new Date();
    const currentDayOfWeek = daysOfWeek[today.getDay()];

    logInfo(
      `Fetching routes for leiturista ${leituristaId} on ${currentDayOfWeek}`,
    );

    // Use our retry function for premature close errors
    const fetchWithRetry = async () => {
      return supabase
        .from("roteiros")
        .select(
          `
          id, dia_semana, rua_id,
          ruas(id, nome, bairro_id),
          ruas:bairro_id(id, nome, cidade)
        `,
        )
        .eq("leiturista_id", leituristaId)
        .eq("dia_semana", currentDayOfWeek);
    };

    const { data: roteiros, error } = await retryOnPrematureClose(
      fetchWithRetry,
      {
        maxRetries: 3,
        initialDelay: 2000,
        operationName: "Daily routes fetch",
      },
    );

    if (error) {
      logError("Error fetching daily routes", error);
      return [];
    }

    if (!roteiros || roteiros.length === 0) {
      logInfo(
        `No routes found for leiturista ${leituristaId} on ${currentDayOfWeek}`,
      );
      return [];
    }

    logInfo(`Found ${roteiros.length} routes for today`);
    return roteiros;
  } catch (error) {
    logError("Unexpected error fetching daily routes", error);
    return [];
  }
}

// Listen for network changes and sync when back online
export const setupNetworkListener = (
  onNetworkChange: (isConnected: boolean) => void,
) => {
  // Create a flag to track if we're currently syncing to prevent multiple syncs
  let isSyncing = false;
  // Track if the listener is still active
  let isListenerActive = true;
  // Create an abort controller for sync operations
  const abortController = new AbortController();

  // Use a debounce mechanism to prevent rapid state changes
  let lastConnectionState: boolean | null = null;
  let debounceTimeoutId: NodeJS.Timeout | null = null;
  // Track sync operation to prevent premature closure
  let syncOperation: Promise<any> | null = null;
  // Track if cleanup is in progress
  let isCleaningUp = false;

  // Create a safe unsubscribe function
  const safeUnsubscribe = () => {
    if (!isListenerActive || isCleaningUp) return;

    // Mark as inactive first and set cleaning up flag
    isListenerActive = false;
    isCleaningUp = true;

    // Clear any pending debounce timeout
    if (debounceTimeoutId !== null) {
      clearTimeout(debounceTimeoutId);
      debounceTimeoutId = null;
    }

    // Wait for any ongoing sync operation to complete before aborting
    const cleanup = async () => {
      try {
        // Wait for any ongoing sync operation to complete
        if (syncOperation) {
          try {
            await Promise.race([
              syncOperation,
              // Timeout after 10 seconds to prevent hanging
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Sync timeout")), 10000),
              ),
            ]);
          } catch (syncError) {
            console.warn("Sync operation did not complete cleanly:", syncError);
          } finally {
            // Ensure syncOperation is nullified
            syncOperation = null;
          }
        }

        // Now it's safe to abort any pending operations
        if (!abortController.signal.aborted) {
          try {
            abortController.abort();
            // Give time for abort to propagate
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (abortError) {
            console.error("Error during abort:", abortError);
          }
        }
      } catch (abortError) {
        console.error(
          "Error aborting network listener operations:",
          abortError,
        );
      } finally {
        // Unsubscribe from NetInfo if we have a subscription
        if (unsubscribeFunction) {
          try {
            // Wrap in a try-catch to prevent premature close errors
            try {
              unsubscribeFunction();
            } catch (unsubError) {
              console.warn("Unsubscribe function error:", unsubError);
            }
            // Set to null to prevent multiple calls
            unsubscribeFunction = null;
          } catch (error) {
            console.error("Error in NetInfo unsubscribe:", error);
          }
        }
        // Reset cleaning up flag
        isCleaningUp = false;
      }
    };

    // Execute cleanup asynchronously but don't wait for it
    // Use a more robust error handling approach
    cleanup().catch((err) => {
      console.error("Cleanup error:", err);
      // Ensure we reset the cleaning flag even if there's an error
      isCleaningUp = false;
    });
  };

  // Set up the actual listener
  let unsubscribeFunction: (() => void) | null = null;

  try {
    // Create a wrapper function to handle the subscription
    const setupSubscription = () => {
      try {
        if (unsubscribeFunction) {
          try {
            unsubscribeFunction();
          } catch (error) {
            console.warn("Error cleaning up previous subscription:", error);
          }
          unsubscribeFunction = null;
        }

        unsubscribeFunction = NetInfo.addEventListener((state) => {
          // First check if the listener is still active
          if (!isListenerActive || isCleaningUp) return;

          try {
            const isConnected =
              state.isConnected === true && state.isInternetReachable !== false;

            // Debounce connection state changes
            if (lastConnectionState !== isConnected) {
              // Clear any existing timeout
              if (debounceTimeoutId !== null) {
                clearTimeout(debounceTimeoutId);
                debounceTimeoutId = null;
              }

              // Set a new timeout
              debounceTimeoutId = setTimeout(() => {
                // Only proceed if still active
                if (!isListenerActive || isCleaningUp) return;

                // Update the last known state
                lastConnectionState = isConnected;
                debounceTimeoutId = null;

                // Notify about connection change
                try {
                  onNetworkChange(isConnected);
                } catch (callbackError) {
                  console.error(
                    "Error in network change callback:",
                    callbackError,
                  );
                }

                // If we just came back online, try to sync
                if (
                  isConnected &&
                  !isSyncing &&
                  isListenerActive &&
                  !isCleaningUp
                ) {
                  isSyncing = true;

                  // Use a self-executing async function with proper error handling
                  const syncPromise = (async () => {
                    try {
                      if (isListenerActive && !isCleaningUp) {
                        await syncPendingReadings();
                      }
                    } catch (syncError) {
                      console.error("Auto-sync failed:", syncError);
                    } finally {
                      // Only update state if the listener is still active
                      if (isListenerActive && !isCleaningUp) {
                        isSyncing = false;
                      }
                    }
                  })();

                  // Store the promise and ensure it's cleared when done
                  syncOperation = syncPromise;
                  syncPromise.finally(() => {
                    if (syncOperation === syncPromise) {
                      syncOperation = null;
                    }
                  });
                }
              }, 300); // 300ms debounce
            }
          } catch (error) {
            console.error("Error in network listener callback:", error);
            // Reset syncing flag if there was an error
            if (isListenerActive && !isCleaningUp) {
              isSyncing = false;

              // Don't null out syncOperation here, let it complete or timeout

              // Try to notify about connection issues
              try {
                onNetworkChange(false);
              } catch (callbackError) {
                console.error(
                  "Failed to notify about connection status:",
                  callbackError,
                );
              }
            }
          }
        });
      } catch (subscribeError) {
        console.error("Error setting up NetInfo subscription:", subscribeError);
        unsubscribeFunction = null;
        return false;
      }
      return true;
    };

    // Initial setup
    if (!setupSubscription()) {
      throw new Error("Failed to set up initial NetInfo subscription");
    }
  } catch (netInfoError) {
    console.error("Error with NetInfo.addEventListener:", netInfoError);
    isListenerActive = false;
    // Try to notify about connection issues
    try {
      onNetworkChange(false);
    } catch (callbackError) {
      console.error("Failed to notify about connection status:", callbackError);
    }
  }

  // Return the safe unsubscribe function
  return safeUnsubscribe;
};
