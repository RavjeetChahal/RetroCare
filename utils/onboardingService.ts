import { createClient } from '@supabase/supabase-js';
import { CaregiverDetails, PatientDetails } from '../hooks/useOnboardingStore';

type OnboardingPayload = {
  clerkId: string;
  caregiver: CaregiverDetails;
  patient: PatientDetails;
  callSchedule: string[];
  voiceChoice: string;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables missing. Onboarding submission will fail.');
}

const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function saveOnboarding(payload: OnboardingPayload) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const age = Number(payload.patient.age);
  if (Number.isNaN(age)) {
    throw new Error('Patient age must be a valid number.');
  }

  const caregiverInsert = {
    clerk_id: payload.clerkId,
    name: payload.caregiver.name,
    timezone: payload.caregiver.timezone,
    phone: payload.caregiver.phone,
  };

  const { data: caregiverData, error: caregiverError } = await supabaseClient
    .from('caregivers')
    .upsert(caregiverInsert, { onConflict: 'clerk_id' })
    .select()
    .single();

  if (caregiverError) {
    throw caregiverError;
  }

  // Determine assigned_assistant from voice_choice (which is now assistant ID)
  // Map assistant ID to assistant name using the voice options
  const { getVoiceOptionByAssistantId } = await import('./voices');
  const voiceOption = getVoiceOptionByAssistantId(payload.voiceChoice);
  const assignedAssistant = voiceOption?.name || null;
  
  const patientInsert = {
    caregiver_id: caregiverData.id,
    name: payload.patient.name,
    age,
    phone: payload.patient.phone,
    timezone: payload.patient.timezone,
    meds: payload.patient.meds,
    conditions: payload.patient.conditions,
    call_schedule: payload.callSchedule,
    voice_choice: payload.voiceChoice, // VAPI assistant ID
    assigned_assistant: assignedAssistant, // Assistant name for easy reference
  };

  const { data: patientData, error: patientError } = await supabaseClient
    .from('patients')
    .insert(patientInsert)
    .select()
    .single();

  if (patientError) {
    throw patientError;
  }

  return patientData;
}

