
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
      electionsChannel = supabase
        .channel('public:elections')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public',
          table: 'elections'
        }, () => {
          onDataChange()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            console.log('Elections channel status:', status)
          }
        })
      
      votesChannel = supabase
        .channel('public:votes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public',
          table: 'votes'
        }, () => {
          onDataChange()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            console.log('Votes channel status:', status)
          }
        })
    } catch (error) {
      console.error('Error setting up real-time subscriptions:', error)
    }

    return () => {
      if (electionsChannel) supabase.removeChannel(electionsChannel)
      if (votesChannel) supabase.removeChannel(votesChannel)
    }
  }, [onDataChange])
}
