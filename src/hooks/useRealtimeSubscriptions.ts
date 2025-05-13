
import { useEffect } from 'react'
import { supabase } from "@/integrations/supabase/client"
import { RealtimeChannel } from '@supabase/supabase-js'

export const useRealtimeSubscriptions = (
  onDataChange: () => Promise<void>
) => {
  useEffect(() => {
    let electionsChannel: RealtimeChannel
    let votesChannel: RealtimeChannel
    
    try {
      console.log("Setting up realtime subscriptions")
      
      // Subscribe to elections table changes
      electionsChannel = supabase
        .channel('elections-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public',
          table: 'elections'
        }, (payload) => {
          console.log('Elections change received:', payload.eventType)
          onDataChange()
        })
        .subscribe((status) => {
          console.log('Elections channel status:', status)
        })
      
      // Subscribe to votes table changes
      votesChannel = supabase
        .channel('votes-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public',
          table: 'votes'
        }, (payload) => {
          console.log('Votes change received:', payload.eventType)
          onDataChange()
        })
        .subscribe((status) => {
          console.log('Votes channel status:', status)
        })
    } catch (error) {
      console.error('Error setting up real-time subscriptions:', error)
    }

    // Cleanup function
    return () => {
      console.log('Cleaning up realtime subscriptions')
      if (electionsChannel) supabase.removeChannel(electionsChannel)
      if (votesChannel) supabase.removeChannel(votesChannel)
    }
  }, [onDataChange])
}
