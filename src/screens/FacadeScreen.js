import React, { useState } from 'react';
import { View, StyleSheet, Alert, Platform, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useAppContext } from '../context/AppContext';
import CameraComponent from '../components/Camera';
import { Ionicons } from '@expo/vector-icons';

/**
 * Tela para captura de foto da fachada da casa
 * @param {Object} props - Propriedades do componente
 * @param {Object} props.navigation - Objeto de navegação
 * @returns {JSX.Element} - Componente da tela
 */
const FacadeScreen = ({ navigation }) => {
  const { addReading } = useAppContext();
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Função para abrir a câmera
  const handleOpenCamera = () => {
    setShowCamera(true);
  };
  
  // Função para quando uma foto for capturada
  const handleCaptureImage = async (image) => {
    // No ambiente web, armazenar apenas o nome do arquivo, não a URI inteira
    // para evitar problemas com localStorage
    if (Platform.OS === 'web') {
      const imageName = `facade_${Date.now()}.jpg`;
      setCapturedImage({
        ...image,
        name: imageName
      });
    } else {
      setCapturedImage(image);
    }
    
    setShowCamera(false);
  };
  
  // Função para fechar a câmera
  const handleCloseCamera = () => {
    setShowCamera(false);
  };
  
  // Função para salvar a fachada
  const handleSaveFacade = async () => {
    if (!capturedImage) {
      Alert.alert('Erro', 'Por favor, tire uma foto da fachada para continuar.');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const facadeData = {
        meter_id: 'FACHADA', // Identificador especial para fachadas
        reading_value: '0', // Não aplicável para fachadas
        client_name: '',
        address: address,
        notes: notes,
        timestamp: new Date().toISOString(),
        synced: false,
        image_path: Platform.OS === 'web' && capturedImage.name 
          ? capturedImage.name 
          : capturedImage.uri,
        is_facade: true // Campo para identificar que é uma fachada
      };
      
      const result = await addReading(facadeData);
      
      if (result) {
        Alert.alert(
          'Sucesso',
          'Foto da fachada salva com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Início')
            }
          ]
        );
      } else {
        throw new Error('Não foi possível salvar a foto da fachada.');
      }
    } catch (error) {
      console.error('Erro ao salvar foto da fachada:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao tentar salvar a foto da fachada.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Função para cancelar a captura
  const handleCancel = () => {
    navigation.goBack();
  };
  
  // Função para descartar a foto capturada
  const handleDiscardPhoto = () => {
    setCapturedImage(null);
  };
  
  // Renderizar a câmera ou o formulário
  if (showCamera) {
    return (
      <CameraComponent
        onCapture={handleCaptureImage}
        onClose={handleCloseCamera}
      />
    );
  }
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Foto da Fachada</Text>
          <Text style={styles.description}>
            Tire uma foto da fachada da casa ou estabelecimento para facilitar a identificação do local.
          </Text>
          
          {capturedImage ? (
            <View style={styles.imageContainer}>
              {/* No ambiente web, quando temos apenas o nome do arquivo, exibir imagem placeholder */}
              {Platform.OS === 'web' && !capturedImage.uri.startsWith('data:') ? (
                <View style={[styles.previewImage, styles.placeholderImage]}>
                  <Ionicons name="image" size={64} color="#4299e1" />
                  <Text style={styles.placeholderText}>Imagem capturada</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: capturedImage.uri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={handleDiscardPhoto}
              >
                <Ionicons name="close-circle" size={24} color="#f56565" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handleOpenCamera}
            >
              <Ionicons name="camera" size={24} color="#4299e1" />
              <Text style={styles.photoButtonText}>Tirar Foto da Fachada</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Endereço</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={20} color="#4299e1" style={styles.inputIcon} />
              <View style={styles.input}>
                <TouchableOpacity onPress={handleOpenCamera}>
                  <Text style={styles.inputText}>
                    {address || 'Toque para adicionar endereço'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Observações</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="create-outline" size={20} color="#4299e1" style={styles.inputIcon} />
              <View style={styles.input}>
                <TouchableOpacity onPress={handleOpenCamera}>
                  <Text style={styles.inputText}>
                    {notes || 'Toque para adicionar observações'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancel}
          disabled={isSaving}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.submitButton, (!capturedImage || isSaving) && styles.buttonDisabled]}
          onPress={handleSaveFacade}
          disabled={!capturedImage || isSaving}
        >
          {isSaving ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="sync" size={20} color="#fff" style={styles.loadingIcon} />
              <Text style={styles.submitButtonText}>Salvando...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Salvar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    height: 250,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
  },
  placeholderText: {
    marginTop: 8,
    color: '#4299e1',
    fontSize: 16,
    fontWeight: '500',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebf8ff',
    borderWidth: 1,
    borderColor: '#bee3f8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  photoButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4299e1',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
  },
  inputText: {
    fontSize: 16,
    color: '#718096',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 16,
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    marginRight: 8,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#4299e1',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingIcon: {
    marginRight: 8,
  },
});

export default FacadeScreen;