import { getSupabaseClient } from './client';
import { logger } from '../../utils';

export async function invokeFunction<T = unknown>(
  functionName: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const supabase = getSupabaseClient();
  logger.info(`Invoking Supabase function: ${functionName}`);
  const { data, error } = await supabase.rpc(functionName, params);

  if (error) {
    logger.error(`Supabase RPC ${functionName} failed`, error);
    throw error;
  }

  return data as T;
}

