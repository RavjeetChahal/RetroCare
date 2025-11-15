import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Make an immediate call to a patient
 */
export async function callNow(patientId: string): Promise<{
  success: boolean;
  callId?: string;
  error?: string;
}> {
  try {
    const response = await apiClient.post('/api/call-now', { patientId });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to make call');
  }
}

/**
 * Generate voice preview using VAPI assistant ID
 */
export async function generatePreview(assistantId: string, text: string): Promise<{
  audio: string;
  format: string;
}> {
  try {
    const response = await apiClient.post('/api/generate-preview', { assistantId, text });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to generate preview');
  }
}

/**
 * Get call logs for a patient
 */
export async function getCallLogs(patientId: string) {
  try {
    const response = await apiClient.get(`/api/call-logs/${patientId}`);
    return response.data.callLogs;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to fetch call logs');
  }
}

