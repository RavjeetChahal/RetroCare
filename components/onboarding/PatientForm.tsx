import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { PatientDetails } from '../../hooks/useOnboardingStore';
import { colors, spacing } from '../../styles/tokens';

type PatientFormProps = {
  value: PatientDetails;
  onChange: (updates: Partial<PatientDetails>) => void;
  onAddMed: (name: string) => void;
  onRemoveMed: (name: string) => void;
  onAddCondition: (name: string) => void;
  onRemoveCondition: (name: string) => void;
};

export function PatientForm({
  value,
  onChange,
  onAddMed,
  onRemoveMed,
  onAddCondition,
  onRemoveCondition,
}: PatientFormProps) {
  const [medInput, setMedInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');

  const handleAddMed = () => {
    if (!medInput.trim()) return;
    onAddMed(medInput.trim());
    setMedInput('');
  };

  const handleAddCondition = () => {
    if (!conditionInput.trim()) return;
    onAddCondition(conditionInput.trim());
    setConditionInput('');
  };

  return (
    <View style={styles.section}>
      <Input
        label="Patient name"
        value={value.name}
        placeholder="Jane Doe"
        onChangeText={(text) => onChange({ name: text })}
      />
      <Input
        label="Age"
        value={value.age}
        placeholder="82"
        keyboardType="number-pad"
        onChangeText={(text) => onChange({ age: text })}
      />
      <Input
        label="Phone"
        value={value.phone}
        placeholder="+1 555 123 4567"
        keyboardType="phone-pad"
        onChangeText={(text) => onChange({ phone: text })}
      />
      <Input
        label="Timezone"
        value={value.timezone}
        placeholder="America/Los_Angeles"
        onChangeText={(text) => onChange({ timezone: text })}
      />

      <TagInput
        label="Medications"
        placeholder="Add medication"
        inputValue={medInput}
        onChangeInput={setMedInput}
        items={value.meds}
        onAdd={handleAddMed}
        onRemove={onRemoveMed}
      />

      <TagInput
        label="Conditions"
        placeholder="Add condition"
        inputValue={conditionInput}
        onChangeInput={setConditionInput}
        items={value.conditions}
        onAdd={handleAddCondition}
        onRemove={onRemoveCondition}
      />
    </View>
  );
}

type InputProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
};

const Input = ({ label, value, placeholder, onChangeText, keyboardType = 'default' }: InputProps) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      value={value}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      style={styles.input}
    />
  </View>
);

type TagInputProps = {
  label: string;
  placeholder: string;
  inputValue: string;
  onChangeInput: (text: string) => void;
  items: string[];
  onAdd: () => void;
  onRemove: (value: string) => void;
};

const TagInput = ({
  label,
  placeholder,
  inputValue,
  onChangeInput,
  items,
  onAdd,
  onRemove,
}: TagInputProps) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      <TextInput
        value={inputValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        onChangeText={onChangeInput}
        style={[styles.input, styles.flex]}
      />
      <Pressable style={styles.addButton} onPress={onAdd}>
        <Text style={styles.addButtonText}>Add</Text>
      </Pressable>
    </View>
    <View style={styles.tagList}>
      {items.map((item) => (
        <Pressable key={item} style={styles.tag} onPress={() => onRemove(item)}>
          <Text style={styles.tagText}>{item}</Text>
        </Pressable>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  tagText: {
    color: colors.textPrimary,
  },
});

