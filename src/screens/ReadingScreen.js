import React, { useState, useRef } from 'react';
import { View, StyleSheet, Alert, Platform, ActivityIndicator, Text, Modal } from 'react-native';
import { useAppContext } from '../context/AppContext';
import MeterReadingForm from '../components/MeterReadingForm';
import CameraComponent from '../components/Camera';
import { processImage } from '../services/ocr';

const ReadingScreen = ({ navigation }) => {
  const { addReading } = useAppContext();
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  
  // Referência para o formulário para atualizar valores
  const formValueRef = useRef({});
  
  // Função para armazenar os valores atuais do formulário
  const updateFormValueRef = (values) => {
    formValueRef.current = values;
  };
  
  // Função para abrir a câmera
  const handleOpenCamera = () => {
    setShowCamera(true);
  };
  
  // Função para quando uma foto for capturada
  const handleCaptureImage = async (image) => {
    console.log("Imagem capturada, iniciando processamento...");
    
    // Sempre usar o objeto de imagem completo com URI
    setCapturedImage(image);
    setShowCamera(false);
    setIsProcessingOcr(true);
    
    try {
      console.log('Iniciando processamento OCR...');
      // Processar a imagem para OCR
      const result = await processImage(image.uri);
      
      console.log('Resultado OCR:', result);
      setOcrResult(result);
      
      if (result && result.text) {
        // Verificar nível de confiança
        const confidenceLevel = Math.round(result.confidence);
        const confiancaTexto = confidenceLevel >= 85 
          ? 'alta' 
          : confidenceLevel >= 70 
            ? 'média' 
            : 'baixa';
        
        const mensagem = confidenceLevel >= 70
          ? `A leitura "${result.text}" foi detectada na imagem com ${confidenceLevel}% de confiança (${confiancaTexto}).\n\nDeseja usar esta leitura?`
          : `A leitura "${result.text}" foi detectada, mas com baixa confiança (${confidenceLevel}%).\n\nRecomendamos verificar o valor antes de confirmar. Deseja usá-lo mesmo assim?`;
          
        Alert.alert(
          'Leitura Automática',
          mensagem,
          [
            {
              text: 'Não',
              style: 'cancel',
              onPress: () => {
                // Continuar com entrada manual
                setOcrResult(null);
              }
            },
            {
              text: 'Sim',
              onPress: () => {
                // Atualizar o formulário com a leitura detectada
                updateReadingValue(result.text);
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'OCR não detectou leitura',
          'Não foi possível detectar a leitura automaticamente. Por favor, verifique se o medidor está visível na foto ou digite o valor manualmente.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erro no processamento OCR:', error);
      Alert.alert(
        'Erro no OCR',
        'Ocorreu um erro durante o processamento da imagem. Por favor, digite o valor manualmente.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessingOcr(false);
    }
  };
  
  // Função para atualizar o valor de leitura no formulário
  const updateReadingValue = (value) => {
    // Esta função é passada para o componente MeterReadingForm
    if (value) {
      console.log("Atualizando valor da leitura no formulário:", value);
      if (formValueRef.current && formValueRef.current.setFieldValue) {
        formValueRef.current.setFieldValue('reading_value', value.toString());
        console.log("Formulário atualizado com o valor detectado");
      } else {
        console.warn("Referência do formulário não disponível para atualização do valor");
      }
    }
  };
  
  // Função para fechar a câmera
  const handleCloseCamera = () => {
    setShowCamera(false);
  };
  
  // Função para salvar a leitura
  const handleSaveReading = async (formData) => {
    setIsSaving(true);
    
    try {
      const reading = {
        ...formData,
        timestamp: new Date().toISOString(),
        synced: false
      };
      
      const result = await addReading(reading);
      
      if (result) {
        Alert.alert(
          'Sucesso',
          'Leitura salva com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log("Redirecionando para a tela inicial");
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Início' }],
                })
              }
            }
          ]
        );
      } else {
        throw new Error('Não foi possível salvar a leitura.');
      }
    } catch (error) {
      console.error('Erro ao salvar leitura:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao tentar salvar a leitura.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Função para cancelar a leitura
  const handleCancel = () => {
    navigation.goBack();
  };
  
  // Renderizar a câmera, o formulário ou a tela de carregamento
  return (
    <View style={styles.container}>
      {showCamera ? (
        <CameraComponent
          onCapture={handleCaptureImage}
          onClose={handleCloseCamera}
        />
      ) : (
        <>
          <MeterReadingForm
            onSubmit={handleSaveReading}
            onCancel={handleCancel}
            onTakePhoto={handleOpenCamera}
            isSaving={isSaving}
            capturedImage={capturedImage}
            onFormRef={updateFormValueRef}
          />
          
          {/* Modal de processamento OCR */}
          <Modal
            transparent={true}
            visible={isProcessingOcr}
            animationType="fade"
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ActivityIndicator size="large" color="#4299e1" />
                <Text style={styles.modalText}>
                  Processando imagem...
                </Text>
                <Text style={styles.modalSubText}>
                  Detectando leitura do hidrômetro
                </Text>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    elevation: 5,
    minWidth: 250,
  },
  modalText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#2d3748',
  },
  modalSubText: {
    fontSize: 14,
    marginTop: 5,
    color: '#718096',
    textAlign: 'center',
  },
});

export default ReadingScreen;