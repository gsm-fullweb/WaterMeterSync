import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import SyncIndicator from '../components/SyncIndicator';
import ReadingListItem from '../components/ReadingListItem';

export default function HomeScreen() {
  const { darkMode } = useAppContext();

  return (
    <ScrollView style={[styles.container, darkMode && styles.darkContainer]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.headerText, darkMode && styles.darkText]}>
          AppLeiturista
        </Text>
        <SyncIndicator />
      </View>

      <View style={styles.content}>
        <Text style={[styles.welcomeText, darkMode && styles.darkText]}>
          Bem-vindo ao AppLeiturista
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#1a1a1a',
  },
  headerContainer: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  welcomeText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
});