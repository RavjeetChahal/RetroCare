import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { usePatientStore } from '../../hooks/usePatientStore';
import type { Patient } from '../../backend/supabase/types';
import { colors, spacing } from '../../styles/tokens';

interface PatientHeaderProps {
  patients: Patient[];
}

export function PatientHeader({ patients }: PatientHeaderProps) {
  const { selectedPatient, setSelectedPatient } = usePatientStore();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Set first patient as default if none selected
  const currentPatient = selectedPatient || patients[0] || null;

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setDropdownVisible(false);
  };

  if (!currentPatient) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Gradient background */}
      <View style={styles.gradientBackground} />
      
      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.content}>
          <Text style={styles.questionText}>How is</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => patients.length > 1 && setDropdownVisible(true)}
          >
            <Text style={styles.patientName}>{currentPatient.name}</Text>
            {patients.length > 1 && (
              <Text style={styles.dropdownIcon}>▼</Text>
            )}
          </Pressable>
          <Text style={styles.questionText}>doing today?</Text>
        </View>
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.dropdownContainer}>
            <FlatList
              data={patients}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.dropdownItem,
                    item.id === currentPatient.id && styles.dropdownItemSelected,
                  ]}
                  onPress={() => handleSelectPatient(item)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      item.id === currentPatient.id && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.id === currentPatient.id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </Pressable>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: -spacing.lg,
    left: -spacing.lg,
    right: -spacing.lg,
    bottom: -spacing.md,
    backgroundColor: colors.card,
    opacity: 0.3,
    borderRadius: 24,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  questionText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 40,
  },
  patientName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#0f172a',
    marginLeft: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dropdownContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.sm,
    minWidth: 200,
    maxWidth: 300,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginVertical: spacing.xs,
  },
  dropdownItemSelected: {
    backgroundColor: colors.accent + '20',
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 18,
    color: colors.accent,
    fontWeight: '700',
  },
});

