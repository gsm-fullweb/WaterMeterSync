import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Image,
  Platform
} from 'react-native';
import { Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useCamera } from '../hooks/useCamera';

/**
 * Camera component for capturing meter readings
 * @param {Object} props - Component props
 * @param {Function} props.onCapture - Callback when image is captured
 * @param {Function} props.onClose - Callback when camera is closed
 * @returns {JSX.Element} - Camera component
 */
const CameraComponent = ({ onCapture, onClose }) => {
  const cameraRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const {
    hasPermission,
    cameraReady,
    cameraType,
    flashMode,
    capturedImage,
    isTakingPicture,
    handleCameraReady,
    takePicture,
    toggleFlash,
    toggleCameraType,
    discardPicture
  } = useCamera(cameraRef);
  
  // Lidar com a permissão da câmera
  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#4299e1" />
        <Text style={styles.permissionText}>Solicitando permissão da câmera...</Text>
      </View>
    );
  }
  
  // Se não tiver permissão
  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-off" size={64} color="#f56565" />
        <Text style={styles.permissionText}>
          Sem acesso à câmera. Por favor, conceda permissão nas configurações do dispositivo.
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Mostrar foto capturada ou interface da câmera
  return (
    <View style={styles.container}>
      {capturedImage ? (
        // Mostrar imagem capturada
        <View style={styles.previewContainer}>
          <Image 
            source={{ uri: capturedImage.uri }} 
            style={styles.previewImage}
            resizeMode="contain"
          />
          
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.discardButton]}
              onPress={discardPicture}
            >
              <Ionicons name="close" size={24} color="#fff" />
              <Text style={styles.actionText}>Descartar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.useButton]}
              onPress={() => onCapture && onCapture(capturedImage)}
            >
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.actionText}>Usar Foto</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Mostrar interface da câmera
        <>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={cameraType}
            flashMode={flashMode}
            onCameraReady={handleCameraReady}
            ratio="4:3"
            autoFocus={Camera.Constants.AutoFocus.on}
          >
            <View style={styles.overlay}>
              <View style={styles.header}>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.focusArea}>
                {/* Área de foco */}
              </View>
              
              <View style={styles.controls}>
                <TouchableOpacity 
                  style={styles.controlButton}
                  onPress={toggleFlash}
                >
                  <Ionicons 
                    name={flashMode === Camera.Constants.FlashMode.on ? 'flash' : 'flash-off'} 
                    size={28} 
                    color="#fff" 
                  />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={async () => {
                    setIsProcessing(true);
                    try {
                      console.log("Iniciando captura da imagem...");
                      const photo = await takePicture();
                      if (photo) {
                        console.log("Imagem capturada com sucesso:", 
                          Platform.OS === 'web' 
                            ? "imagem em base64" 
                            : photo.uri.substring(0, 20) + "...");
                      } else {
                        console.warn("Falha ao capturar foto");
                      }
                    } catch (error) {
                      console.error("Erro ao capturar foto:", error);
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={!cameraReady || isProcessing || isTakingPicture}
                >
                  {isProcessing || isTakingPicture ? (
                    <ActivityIndicator size="large" color="#fff" />
                  ) : (
                    <View style={styles.captureButtonInner} />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.controlButton}
                  onPress={toggleCameraType}
                >
                  <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </Camera>
          
          <View style={styles.helperTextContainer}>
            <Text style={styles.helperText}>
              Posicione o visor do hidrômetro no centro da tela
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  permissionText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#4a5568',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  focusArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  controlButton: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  helperTextContainer: {
    backgroundColor: '#2d3748',
    padding: 12,
  },
  helperText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 14,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    backgroundColor: '#2d3748',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: 'center',
  },
  discardButton: {
    backgroundColor: '#f56565',
  },
  useButton: {
    backgroundColor: '#48bb78',
  },
  actionText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default CameraComponent;