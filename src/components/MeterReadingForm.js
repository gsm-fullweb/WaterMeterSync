import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Meter reading form component
 * @param {Object} props - Component props
 * @param {Object} props.initialData - Initial data for the form
 * @param {Function} props.onSubmit - Callback when form is submitted
 * @param {Function} props.onCancel - Callback when form is cancelled
 * @param {Function} props.onTakePhoto - Callback to open camera
 * @param {boolean} props.isSaving - Flag indicating if form is being saved
 * @param {Object} props.capturedImage - Captured image object
 * @param {Function} props.onFormRef - Callback to pass form reference for external control
 * @returns {JSX.Element} - Meter reading form component
 */
const MeterReadingForm = ({ 
  initialData = {}, 
  onSubmit, 
  onCancel, 
  onTakePhoto,
  isSaving = false,
  capturedImage = null,
  onFormRef = null
}) => {
  // Estado do formulário
  const [formData, setFormData] = useState({
    meter_id: '',
    reading_value: '',
    client_name: '',
    address: '',
    notes: '',
    image_path: null,
    ...initialData
  });
  
  const [errors, setErrors] = useState({});
  
  // Atualizar caminho da imagem quando capturedImage mudar
  useEffect(() => {
    if (capturedImage) {
      console.log("Atualizando imagem no formulário:", 
        Platform.OS === 'web' ? 'Imagem em formato web' : capturedImage.uri.substring(0, 30) + '...');
      
      setFormData(prev => ({
        ...prev,
        image_path: capturedImage.uri // Sempre usar o URI, seja no formato data:image/jpeg;base64 (web) ou file:// (nativo)
      }));
    }
  }, [capturedImage]);
  
  // Preservar a imagem inicial quando o componente for montado
  useEffect(() => {
    if (initialData && initialData.image_path) {
      setFormData(prev => ({
        ...prev,
        image_path: initialData.image_path
      }));
    }
  }, []);
  
  // Expor métodos para atualização externa do formulário
  useEffect(() => {
    if (onFormRef) {
      onFormRef({
        // Método para atualizar um campo específico do formulário
        setFieldValue: (field, value) => {
          handleChange(field, value);
        },
        // Adicionar valores do formulário atual
        formData
      });
    }
  }, [formData]);
  
  // Atualizar campo do formulário
  const handleChange = (field, value) => {
    // Limpar erro quando campo é alterado
    setErrors(prev => ({
      ...prev,
      [field]: null
    }));
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Validar formulário
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.meter_id.trim()) {
      newErrors.meter_id = 'O número do medidor é obrigatório';
    }
    
    if (!formData.reading_value.trim()) {
      newErrors.reading_value = 'A leitura é obrigatória';
    } else if (!/^\d+(\.\d+)?$/.test(formData.reading_value)) {
      newErrors.reading_value = 'A leitura deve ser um número válido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Remover a foto
  const handleRemovePhoto = () => {
    setFormData(prev => ({
      ...prev,
      image_path: null
    }));
  };
  
  // Submeter formulário
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit && onSubmit(formData);
    } else {
      Alert.alert(
        'Formulário Inválido',
        'Por favor, corrija os erros antes de salvar.',
        [{ text: 'OK' }]
      );
    }
  };
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Campos do medidor */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Número do Medidor *</Text>
          <TextInput
            style={[styles.input, errors.meter_id && styles.inputError]}
            value={formData.meter_id}
            onChangeText={(value) => handleChange('meter_id', value)}
            placeholder="Ex: 123456"
            keyboardType="default"
            autoCapitalize="none"
          />
          {errors.meter_id && (
            <Text style={styles.errorText}>{errors.meter_id}</Text>
          )}
        </View>
        
        {/* Leitura do medidor */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Leitura *</Text>
          <TextInput
            style={[styles.input, errors.reading_value && styles.inputError]}
            value={formData.reading_value}
            onChangeText={(value) => handleChange('reading_value', value)}
            placeholder="Ex: 12345.67"
            keyboardType="numeric"
          />
          {errors.reading_value && (
            <Text style={styles.errorText}>{errors.reading_value}</Text>
          )}
        </View>
        
        {/* Nome do cliente */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Nome do Cliente</Text>
          <TextInput
            style={styles.input}
            value={formData.client_name}
            onChangeText={(value) => handleChange('client_name', value)}
            placeholder="Ex: João Silva"
          />
        </View>
        
        {/* Endereço */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Endereço</Text>
          <TextInput
            style={styles.input}
            value={formData.address}
            onChangeText={(value) => handleChange('address', value)}
            placeholder="Ex: Rua das Flores, 123"
          />
        </View>
        
        {/* Observações */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Observações</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.notes}
            onChangeText={(value) => handleChange('notes', value)}
            placeholder="Ex: Hidrômetro com vazamento"
            multiline
            numberOfLines={3}
          />
        </View>
        
        {/* Foto do medidor */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Foto do Medidor</Text>
          
          {formData.image_path ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: formData.image_path }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={handleRemovePhoto}
              >
                <Ionicons name="close-circle" size={24} color="#f56565" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoButton}
              onPress={onTakePhoto}
            >
              <Ionicons name="camera" size={24} color="#4299e1" />
              <Text style={styles.photoButtonText}>Tirar Foto</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      
      {/* Botões de ação */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={isSaving}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.submitButton, isSaving && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Salvar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  formContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: '#2d3748',
  },
  inputError: {
    borderColor: '#f56565',
  },
  errorText: {
    color: '#f56565',
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebf8ff',
    borderWidth: 1,
    borderColor: '#bee3f8',
    borderRadius: 6,
    padding: 12,
  },
  photoButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4299e1',
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 6,
    overflow: 'hidden',
    height: 200,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
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
    padding: 12,
    borderRadius: 6,
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
  }
});

export default MeterReadingForm;