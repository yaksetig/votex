
import { supabase } from "@/integrations/supabase/client";
import { EdwardsPoint } from '@/services/elGamalService';
import { logger } from '@/services/logger';

// Generate and store discrete log lookup table in Supabase.
// If the table already has entries but fewer than needed (e.g. initialized
// with maxValue=2 for nullification but now delegation needs higher values),
// the table is extended with the missing entries.
export async function initializeDiscreteLogTable(maxValue: number = 100): Promise<boolean> {
  try {
    logger.debug(`Initializing discrete log table with max value: ${maxValue}`);

    // Find the current highest value in the table
    const { data: maxRow, error: checkError } = await supabase
      .from('discrete_log_lookup')
      .select('discrete_log_value')
      .order('discrete_log_value', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError) {
      logger.error('Error checking discrete log table:', checkError);
      return false;
    }

    const currentMax = maxRow?.discrete_log_value ?? -1;

    if (currentMax >= maxValue) {
      logger.debug(`Discrete log table already covers 0..${currentMax} (need ${maxValue})`);
      return true;
    }

    // Compute entries from (currentMax + 1) up to maxValue
    const startFrom = currentMax + 1;
    const G = EdwardsPoint.base();

    // Compute startFrom * G by multiplying (avoids replaying the full chain)
    let current =
      startFrom === 0
        ? EdwardsPoint.identity()
        : G.multiply(BigInt(startFrom));

    const entries = [];

    for (let n = startFrom; n <= maxValue; n++) {
      entries.push({
        point_string: current.toString(),
        discrete_log_value: n
      });

      if (n < maxValue) {
        current = current.add(G);
      }
    }

    if (entries.length === 0) {
      return true;
    }

    const { error: insertError } = await supabase
      .from('discrete_log_lookup')
      .insert(entries);

    if (insertError) {
      logger.error('Error inserting discrete log entries:', insertError);
      return false;
    }

    logger.debug(
      `Extended discrete log table: added entries ${startFrom}..${maxValue} (${entries.length} new)`
    );
    return true;
  } catch (error) {
    logger.error('Error in initializeDiscreteLogTable:', error);
    return false;
  }
}

// Get discrete log value from Supabase
export async function getDiscreteLogFromDB(pointString: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('discrete_log_lookup')
      .select('discrete_log_value')
      .eq('point_string', pointString)
      .maybeSingle();
      
    if (error) {
      logger.error('Error fetching discrete log:', error);
      return null;
    }
    
    return data?.discrete_log_value ?? null;
  } catch (error) {
    logger.error('Error in getDiscreteLogFromDB:', error);
    return null;
  }
}

// Clear the discrete log table (admin function)
export async function clearDiscreteLogTable(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('clear_discrete_log_table');
    
    if (error) {
      logger.error('Error clearing discrete log table:', error);
      return false;
    }
    
    logger.debug('Successfully cleared discrete log table');
    return true;
  } catch (error) {
    logger.error('Error in clearDiscreteLogTable:', error);
    return false;
  }
}

// Get the count of entries in the discrete log table
export async function getDiscreteLogTableSize(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('discrete_log_lookup')
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      logger.error('Error getting table size:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    logger.error('Error in getDiscreteLogTableSize:', error);
    return 0;
  }
}
