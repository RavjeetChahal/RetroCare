import { CaregiverDetails, PatientDetails } from '../hooks/useOnboardingStore';
import { getVoiceOptionByAssistantId } from './voices';
import { getSupabaseClient } from './supabaseClient';

type OnboardingPayload = {
  clerkId: string;
  caregiver: CaregiverDetails;
  patient: PatientDetails;
  callSchedule: string[];
  voiceChoice: string;
};

export async function saveOnboarding(payload: OnboardingPayload) {
  console.log('[OnboardingService] Starting saveOnboarding...');
  console.log('[OnboardingService] Environment check:', {
    hasSupabaseUrl: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL
      ? `${process.env.EXPO_PUBLIC_SUPABASE_URL.substring(0, 30)}...`
      : 'missing',
  });

  const supabaseClient = getSupabaseClient();

  const age = Number(payload.patient.age);
  if (Number.isNaN(age)) {
    const error = `Patient age must be a valid number. Received: "${payload.patient.age}"`;
    console.error('[OnboardingService]', error);
    throw new Error(error);
  }

  console.log('[OnboardingService] Validated payload:', {
    clerkId: payload.clerkId,
    caregiverName: payload.caregiver.name,
    patientName: payload.patient.name,
    patientAge: age,
    voiceChoice: payload.voiceChoice,
  });

  const caregiverInsert = {
    clerk_id: payload.clerkId,
    name: payload.caregiver.name,
    timezone: payload.caregiver.timezone,
    phone: payload.caregiver.phone,
  };

  console.log('[OnboardingService] Upserting caregiver...');
  const { data: caregiverData, error: caregiverError } = await supabaseClient
    .from('caregivers')
    .upsert(caregiverInsert, { onConflict: 'clerk_id' })
    .select()
    .single();

  if (caregiverError) {
    console.error('[OnboardingService] Caregiver upsert error:', caregiverError);
    throw caregiverError;
  }
  console.log('[OnboardingService] Caregiver saved:', caregiverData?.id);

  // Determine assigned_assistant from voice_choice (which is now assistant ID)
  // Map assistant ID to assistant name using the voice options
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

  console.log('[OnboardingService] Inserting patient...');
  const { data: patientData, error: patientError } = await supabaseClient
    .from('patients')
    .insert(patientInsert)
    .select()
    .single();

  if (patientError) {
    console.error('[OnboardingService] Patient insert error:', patientError);
    console.error('[OnboardingService] Patient insert data:', patientInsert);
    throw patientError;
  }
  
  console.log('[OnboardingService] Patient saved successfully:', patientData?.id);
  return patientData;
}

