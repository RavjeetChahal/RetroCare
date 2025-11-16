import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabaseClient } from '../utils/supabaseClient';

type Options = {
  caregiverId?: string;
  patientId?: string;
  patientIds?: string[];
};

function getPatientIdFromPayload(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
  return (payload.new?.patient_id as string) ?? (payload.old?.patient_id as string) ?? null;
}

export function useRealtimeSync({ caregiverId, patientId, patientIds = [] }: Options) {
  const queryClient = useQueryClient();

  const patientIdsSignature = useMemo(() => {
    return [...patientIds].filter(Boolean).sort().join(',');
  }, [patientIds]);

  const patientIdsSet = useMemo(() => {
    if (!patientIdsSignature) {
      return new Set<string>();
    }
    return new Set(patientIdsSignature.split(',').filter(Boolean));
  }, [patientIdsSignature]);

  useEffect(() => {
    if (!supabaseClient || !caregiverId) {
      return;
    }

    const caregiverChannel = supabaseClient
      .channel(`dashboard-caregiver-${caregiverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients', filter: `caregiver_id=eq.${caregiverId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['patients', caregiverId] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs' },
        (payload) => {
          const affectedPatientId = getPatientIdFromPayload(payload);
          if (patientIdsSet.size > 0 && (!affectedPatientId || !patientIdsSet.has(affectedPatientId))) {
            return;
          }

          queryClient.invalidateQueries({ queryKey: ['callLogs'] });

          if (affectedPatientId) {
            queryClient.invalidateQueries({ queryKey: ['calls', affectedPatientId, 'today'] });
          }
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(caregiverChannel);
    };
  }, [caregiverId, patientIdsSet, queryClient]);

  useEffect(() => {
    if (!supabaseClient || !patientId) {
      return;
    }

    const patientChannel = supabaseClient
      .channel(`dashboard-patient-${patientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs', filter: `patient_id=eq.${patientId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['calls', patientId, 'today'] });
          queryClient.invalidateQueries({ queryKey: ['callLogs'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mood_logs', filter: `patient_id=eq.${patientId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['mood', patientId, 'today'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'med_logs', filter: `patient_id=eq.${patientId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['medications', patientId, 'today'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flags', filter: `patient_id=eq.${patientId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['flags', patientId, 'today'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sleep_logs', filter: `patient_id=eq.${patientId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sleep', patientId, 'today'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_checkins', filter: `patient_id=eq.${patientId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sleep', patientId, 'today'] });
          queryClient.invalidateQueries({ queryKey: ['flags', patientId, 'today'] });
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(patientChannel);
    };
  }, [patientId, queryClient]);
}


