import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  Text, 
  Modal, 
  ScrollView, 
  TextInput,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import CameraComponent from '../components/Camera';
import { processImage } from '../services/ocr';
import { marcarComoVisitada } from '../services/syncRoteiro';

/**
 * Tela de leitura para roteiro diário
 * @param {Object} props - Propriedades do componente
 * @param {Object} props.route - Objeto de rota com parâmetros
 * @param {Object} props.navigation - Objeto de navegação
 * @returns {JSX.Element} - Componente da tela
 */
const LeituraRoteiroScreen = ({ route, navigation }) => {
  const { addReading } = useAppContext();
  const { ruaNome, casa, dataRoteiro, onLeituraCompleta } = route.params;
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  
  // Referência para o formulário para atualizar valores
  const formValueRef = useRef({});
  
  // Dados iniciais do formulário
  const initialData = {
    meter_id: casa.numero,
    reading_value: '',
    client_name: casa.cliente_nome,
    address: `${ruaNome}, ${casa.numero}`,
    notes: '',
    image_path: null
  };
  
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
                console.log("Atualizando valor da leitura no formulário:", result.text);
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
  
  // Função para salvar a leitura e marcar como visitada
  const handleSaveReading = async (formData) => {
    setIsSaving(true);
    
    try {
      const reading = {
        ...formData,
        timestamp: new Date().toISOString(),
        synced: false,
        cliente_id: casa.cliente_id,
        rua: ruaNome
      };
      
      // Salvar leitura no banco de dados local
      const result = await addReading(reading);
      
      if (result) {
        // Marcar como visitada no roteiro
        await marcarComoVisitada(dataRoteiro, ruaNome, casa.cliente_id, reading);
        
        Alert.alert(
          'Sucesso',
          'Leitura registrada com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Chamar callback para atualizar o roteiro
                if (onLeituraCompleta) {
                  onLeituraCompleta();
                }
                
                // Retornar para a tela anterior
                navigation.goBack();
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
  
  // Estado local para o valor da leitura
  const [leituraValor, setLeituraValor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  
  // Efeito para atualizar o valor da leitura quando vier do OCR
  useEffect(() => {
    if (ocrResult && ocrResult.text) {
      setLeituraValor(ocrResult.text);
    }
  }, [ocrResult]);
  
  // Função para submeter o formulário simplificado
  const handleSubmit = () => {
    if (!leituraValor.trim()) {
      Alert.alert('Erro', 'Por favor, insira o valor da leitura.');
      return;
    }
    
    // Criar objeto com todos os dados e chamar a função de salvar
    const formData = {
      meter_id: casa.numero,
      reading_value: leituraValor,
      client_name: casa.cliente_nome,
      address: `${ruaNome}, ${casa.numero}`,
      notes: observacoes,
      image_path: capturedImage ? capturedImage.uri : null
    };
    
    handleSaveReading(formData);
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
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Registrar Leitura</Text>
              <View style={styles.headerInfo}>
                <Text style={styles.headerAddress}>{ruaNome}, {casa.numero}</Text>
                <Text style={styles.headerClient}>{casa.cliente_nome}</Text>
              </View>
            </View>
            
            <View style={styles.formContainer}>
              {/* Dados do cliente - apenas visualização */}
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Número do Medidor:</Text>
                  <Text style={styles.infoValue}>{casa.numero}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Cliente:</Text>
                  <Text style={styles.infoValue}>{casa.cliente_nome}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Endereço:</Text>
                  <Text style={styles.infoValue}>{ruaNome}, {casa.numero}</Text>
                </View>
              </View>
              
              {/* Seção principal - entrada da leitura */}
              <View style={styles.readingSection}>
                <Text style={styles.sectionTitle}>Leitura do Medidor</Text>
                
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.readingInput}
                    placeholder="Digite o valor da leitura"
                    value={leituraValor}
                    onChangeText={setLeituraValor}
                    keyboardType="numeric"
                    autoFocus={true}
                  />
                </View>
                
                <View style={styles.photoSection}>
                  <TouchableOpacity
                    style={styles.cameraButton}
                    onPress={handleOpenCamera}
                  >
                    <Ionicons name="camera" size={24} color="#fff" />
                    <Text style={styles.buttonText}>
                      {capturedImage ? 'Nova Foto' : 'Tirar Foto do Medidor'}
                    </Text>
                  </TouchableOpacity>
                  
                  {capturedImage && (
                    <View style={styles.thumbnailContainer}>
                      <Text style={styles.capturedLabel}>Foto capturada</Text>
                      <View style={styles.thumbnail}>
                        <Ionicons name="checkmark-circle" size={24} color="#48bb78" />
                      </View>
                    </View>
                  )}
                </View>
                
                <View style={styles.notesContainer}>
                  <Text style={styles.inputLabel}>Observações (opcional):</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Insira observações, se necessário"
                    value={observacoes}
                    onChangeText={setObservacoes}
                    multiline={true}
                    numberOfLines={3}
                  />
                </View>
              </View>
              
              {/* Botões de ação */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleCancel}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, isSaving && styles.disabledButton]}
                  onPress={handleSubmit}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
          
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
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#4299e1',
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
  },
  headerAddress: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  headerClient: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  // Estilos do novo formulário
  formContainer: {
    padding: 16,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: '600',
    color: '#4a5568',
    width: '40%',
  },
  infoValue: {
    color: '#2d3748',
    flex: 1,
  },
  readingSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    backgroundColor: '#EDF2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  readingInput: {
    fontSize: 24,
    paddingVertical: 12,
    color: '#2d3748',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 4,
  },
  photoSection: {
    marginVertical: 16,
    alignItems: 'center',
  },
  cameraButton: {
    flexDirection: 'row',
    backgroundColor: '#3182ce',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  thumbnailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  capturedLabel: {
    color: '#48bb78',
    marginRight: 8,
  },
  thumbnail: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0fff4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  notesContainer: {
    marginTop: 8,
  },
  notesInput: {
    backgroundColor: '#EDF2F7',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  button: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#4a5568',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#38A169',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  // Modal styles
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

export default LeituraRoteiroScreen;