
import { createClient } from '@supabase/supabase-js';

// Using direct values instead of environment variables
const supabaseUrl = 'https://uficgolgcwvgxqlubpso.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWNnb2xnY3d2Z3hxbHVicHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzY2NDcsImV4cCI6MjA1OTcxMjY0N30.xFYmgi3ABvnWUqn4T9hb6jgoHJ2KqLvzN5MlhYy68Cw';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'X-Client-Info': 'votex-platform',
      },
    },
  }
);
