import { useState, useEffect } from 'react';
import { Camera } from 'expo-camera';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

/**
 * Hook for camera functionality
 * @returns {Object} - Camera state and functions
 */
export const useCamera = (cameraRef) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraType, setCameraType] = useState(Camera.Constants.Type.back);
  const [flashMode, setFlashMode] = useState(Camera.Constants.FlashMode.off);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  
  /**
   * Request camera permissions
   * @returns {Promise<boolean>} - Permission granted status
   */
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (error) {
        console.error('Error requesting camera permissions:', error);
        setHasPermission(false);
      }
    };
    
    requestPermissions();
  }, []);
  
  /**
   * Handle camera ready state
   */
  const handleCameraReady = () => {
    setCameraReady(true);
  };
  
  /**
   * Convert blob to base64
   * @param {Blob} blob - The blob to convert
   * @returns {Promise<string>} - Base64 data URL
   */
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });
  };
  
  /**
   * Capture an image from the camera
   * @returns {Promise<Object>} - Captured image info or null
   */
  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady || isTakingPicture) {
      return null;
    }
    
    try {
      setIsTakingPicture(true);
      
      // Configurações diferentes para web e dispositivos nativos
      const photoOptions = Platform.OS === 'web' 
        ? {
            quality: 0.85,
            base64: true,
            exif: false
          }
        : {
            quality: 0.85,
            base64: false,
            skipProcessing: Platform.OS === 'android', // Avoid post-processing on Android for speed
            exif: false
          };
        
      const photo = await cameraRef.current.takePictureAsync(photoOptions);
      
      // No ambiente web, o resultado pode ser retornado como URI blob://
      if (Platform.OS === 'web' && photo.uri && photo.uri.startsWith('blob:')) {
        // Se temos o base64, podemos usá-lo diretamente
        if (photo.base64) {
          photo.uri = `data:image/jpeg;base64,${photo.base64}`;
        } 
        // Caso contrário, precisamos converter o blob para base64
        else {
          try {
            const response = await fetch(photo.uri);
            const blob = await response.blob();
            const base64 = await blobToBase64(blob);
            
            photo.uri = base64;
            photo.base64 = base64.split(',')[1]; // Remover o prefixo 'data:image/jpeg;base64,'
          } catch (error) {
            console.error('Error converting blob to base64:', error);
          }
        }
      }
      
      setCapturedImage(photo);
      return photo;
    } catch (error) {
      console.error('Error taking picture:', error);
      return null;
    } finally {
      setIsTakingPicture(false);
    }
  };
  
  /**
   * Toggle camera flash mode
   */
  const toggleFlash = () => {
    setFlashMode(prevMode => 
      prevMode === Camera.Constants.FlashMode.off
        ? Camera.Constants.FlashMode.on
        : Camera.Constants.FlashMode.off
    );
  };
  
  /**
   * Discard the captured image
   */
  const discardPicture = () => {
    setCapturedImage(null);
  };
  
  /**
   * Toggle camera type (front/back)
   */
  const toggleCameraType = () => {
    setCameraType(prevType =>
      prevType === Camera.Constants.Type.back
        ? Camera.Constants.Type.front
        : Camera.Constants.Type.back
    );
  };
  
  return {
    hasPermission,
    cameraReady,
    cameraType,
    flashMode,
    capturedImage,
    handleCameraReady,
    takePicture,
    toggleFlash,
    toggleCameraType,
    discardPicture,
    isTakingPicture
  };
};