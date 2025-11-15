import { create } from 'zustand';

export type CaregiverDetails = {
  name: string;
  phone: string;
  timezone: string;
};

export type PatientDetails = {
  name: string;
  age: string;
  phone: string;
  timezone: string;
  meds: string[];
  conditions: string[];
};

type OnboardingState = {
  step: number;
  caregiver: CaregiverDetails;
  patient: PatientDetails;
  callSchedule: string[];
  voiceChoice: string;
  isSubmitting: boolean;
  setCaregiver: (updates: Partial<CaregiverDetails>) => void;
  setPatient: (updates: Partial<PatientDetails>) => void;
  addMed: (name: string) => void;
  removeMed: (name: string) => void;
  addCondition: (name: string) => void;
  removeCondition: (name: string) => void;
  toggleTimeSlot: (slot: string) => void;
  setVoiceChoice: (voiceId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
};

const initialState = {
  caregiver: {
    name: '',
    phone: '',
    timezone: '',
  },
  patient: {
    name: '',
    age: '',
    phone: '',
    timezone: '',
    meds: [],
    conditions: [],
  },
  callSchedule: [] as string[],
  voiceChoice: '',
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  step: 0,
  ...initialState,
  isSubmitting: false,
  setCaregiver: (updates) =>
    set((state) => ({
      caregiver: {
        ...state.caregiver,
        ...updates,
      },
    })),
  setPatient: (updates) =>
    set((state) => ({
      patient: {
        ...state.patient,
        ...updates,
      },
    })),
  addMed: (name) =>
    set((state) => ({
      patient: {
        ...state.patient,
        meds: Array.from(new Set([...state.patient.meds, name.trim()])).filter(Boolean),
      },
    })),
  removeMed: (name) =>
    set((state) => ({
      patient: {
        ...state.patient,
        meds: state.patient.meds.filter((item) => item !== name),
      },
    })),
  addCondition: (name) =>
    set((state) => ({
      patient: {
        ...state.patient,
        conditions: Array.from(new Set([...state.patient.conditions, name.trim()])).filter(Boolean),
      },
    })),
  removeCondition: (name) =>
    set((state) => ({
      patient: {
        ...state.patient,
        conditions: state.patient.conditions.filter((item) => item !== name),
      },
    })),
  toggleTimeSlot: (slot) =>
    set((state) => {
      const exists = state.callSchedule.includes(slot);
      return {
        callSchedule: exists
          ? state.callSchedule.filter((time) => time !== slot)
          : [...state.callSchedule, slot],
      };
    }),
  setVoiceChoice: (voiceChoice) => set({ voiceChoice }),
  nextStep: () => set((state) => ({ step: Math.min(state.step + 1, 4) })),
  prevStep: () => set((state) => ({ step: Math.max(state.step - 1, 0) })),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  reset: () => set({ step: 0, ...initialState, isSubmitting: false }),
}));

