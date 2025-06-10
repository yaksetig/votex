
import { supabase } from "@/integrations/supabase/client";
import { EdwardsPoint } from '@/services/elGamalService';

// Generate and store discrete log lookup table in Supabase
export async function initializeDiscreteLogTable(maxValue: number = 100): Promise<boolean> {
  try {
    console.log(`Initializing discrete log table with max value: ${maxValue}`);
    
    // Check if table is already populated
    const { data: existingData, error: checkError } = await supabase
      .from('discrete_log_lookup')
      .select('discrete_log_value')
      .limit(1);
      
    if (checkError) {
      console.error('Error checking discrete log table:', checkError);
      return false;
    }
    
    if (existingData && existingData.length > 0) {
      console.log('Discrete log table already initialized');
      return true;
    }
    
    // Generate the lookup table data
    const G = EdwardsPoint.base();
    let current = EdwardsPoint.identity(); // Identity element (0*G)
    const entries = [];
    
    for (let n = 0; n <= maxValue; n++) {
      entries.push({
        point_string: current.toString(),
        discrete_log_value: n
      });
      
      if (n < maxValue) {
        current = current.add(G);
      }
    }
    
    // Insert all entries into the database
    const { error: insertError } = await supabase
      .from('discrete_log_lookup')
      .insert(entries);
      
    if (insertError) {
      console.error('Error inserting discrete log entries:', insertError);
      return false;
    }
    
    console.log(`Successfully initialized discrete log table with ${entries.length} entries`);
    return true;
  } catch (error) {
    console.error('Error in initializeDiscreteLogTable:', error);
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
      console.error('Error fetching discrete log:', error);
      return null;
    }
    
    return data?.discrete_log_value ?? null;
  } catch (error) {
    console.error('Error in getDiscreteLogFromDB:', error);
    return null;
  }
}

// Clear the discrete log table (admin function)
export async function clearDiscreteLogTable(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('clear_discrete_log_table');
    
    if (error) {
      console.error('Error clearing discrete log table:', error);
      return false;
    }
    
    console.log('Successfully cleared discrete log table');
    return true;
  } catch (error) {
    console.error('Error in clearDiscreteLogTable:', error);
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
      console.error('Error getting table size:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error in getDiscreteLogTableSize:', error);
    return 0;
  }
}
