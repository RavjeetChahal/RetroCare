import { create } from 'zustand';
import type { Patient } from '../backend/supabase/types';

interface PatientStore {
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
}

export const usePatientStore = create<PatientStore>((set) => ({
  selectedPatient: null,
  setSelectedPatient: (patient) => set({ selectedPatient: patient }),
}));

