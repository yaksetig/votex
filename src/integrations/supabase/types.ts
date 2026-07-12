export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      delegations: {
        Row: {
          created_at: string
          delegate_ct_c1_x: string
          delegate_ct_c1_y: string
          delegate_ct_c2_x: string
          delegate_ct_c2_y: string
          delegator_id: string
          election_id: string
          id: string
          revoked_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          delegate_ct_c1_x: string
          delegate_ct_c1_y: string
          delegate_ct_c2_x: string
          delegate_ct_c2_y: string
          delegator_id: string
          election_id: string
          id?: string
          revoked_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          delegate_ct_c1_x?: string
          delegate_ct_c1_y?: string
          delegate_ct_c2_x?: string
          delegate_ct_c2_y?: string
          delegator_id?: string
          election_id?: string
          id?: string
          revoked_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegations_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      discrete_log_lookup: {
        Row: {
          discrete_log_value: number
          point_string: string
        }
        Insert: {
          discrete_log_value: number
          point_string: string
        }
        Update: {
          discrete_log_value?: number
          point_string?: string
        }
        Relationships: []
      }
      election_authorities: {
        Row: {
          auth_user_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          public_key_x: string
          public_key_y: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          public_key_x: string
          public_key_y: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          public_key_x?: string
          public_key_y?: string
          updated_at?: string
        }
        Relationships: []
      }
      election_authority_audit_log: {
        Row: {
          action: string
          auth_user_id: string | null
          details: Json | null
          election_id: string | null
          id: string
          performed_at: string
          performed_by: string
        }
        Insert: {
          action: string
          auth_user_id?: string | null
          details?: Json | null
          election_id?: string | null
          id?: string
          performed_at?: string
          performed_by: string
        }
        Update: {
          action?: string
          auth_user_id?: string | null
          details?: Json | null
          election_id?: string | null
          id?: string
          performed_at?: string
          performed_by?: string
        }
        Relationships: []
      }
      election_creation_requests: {
        Row: {
          created_at: string
          creator: string
          election_id: string
          idempotency_key: string
        }
        Insert: {
          created_at?: string
          creator: string
          election_id: string
          idempotency_key: string
        }
        Update: {
          created_at?: string
          creator?: string
          election_id?: string
          idempotency_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_creation_requests_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      election_participants: {
        Row: {
          election_id: string
          id: string
          joined_at: string
          participant_id: string
          public_key_x: string
          public_key_y: string
        }
        Insert: {
          election_id: string
          id?: string
          joined_at?: string
          participant_id: string
          public_key_x: string
          public_key_y: string
        }
        Update: {
          election_id?: string
          id?: string
          joined_at?: string
          participant_id?: string
          public_key_x?: string
          public_key_y?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_participants_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      election_tallies: {
        Row: {
          election_id: string
          id: string
          nullification_count: number
          processed_at: string
          processed_by: string | null
          tally_run_id: string | null
          user_id: string
          vote_nullified: boolean
          vote_weight: number
        }
        Insert: {
          election_id: string
          id?: string
          nullification_count?: number
          processed_at?: string
          processed_by?: string | null
          tally_run_id?: string | null
          user_id: string
          vote_nullified?: boolean
          vote_weight?: number
        }
        Update: {
          election_id?: string
          id?: string
          nullification_count?: number
          processed_at?: string
          processed_by?: string | null
          tally_run_id?: string | null
          user_id?: string
          vote_nullified?: boolean
          vote_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_election_tallies_election_id"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_tallies_tally_run_id_fkey"
            columns: ["tally_run_id"]
            isOneToOne: false
            referencedRelation: "election_tally_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      election_tally_runs: {
        Row: {
          election_id: string
          id: string
          processed_at: string
          processed_by: string
          replaced_run_id: string | null
          result_count: number
        }
        Insert: {
          election_id: string
          id?: string
          processed_at?: string
          processed_by: string
          replaced_run_id?: string | null
          result_count?: number
        }
        Update: {
          election_id?: string
          id?: string
          processed_at?: string
          processed_by?: string
          replaced_run_id?: string | null
          result_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "election_tally_runs_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_tally_runs_replaced_run_id_fkey"
            columns: ["replaced_run_id"]
            isOneToOne: false
            referencedRelation: "election_tally_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          authority_id: string | null
          closed_manually_at: string | null
          created_at: string
          creator: string
          description: string
          end_date: string
          id: string
          last_modified_at: string | null
          last_modified_by: string | null
          option1: string
          option2: string
          status: string | null
          title: string
        }
        Insert: {
          authority_id?: string | null
          closed_manually_at?: string | null
          created_at?: string
          creator: string
          description: string
          end_date: string
          id?: string
          last_modified_at?: string | null
          last_modified_by?: string | null
          option1?: string
          option2?: string
          status?: string | null
          title: string
        }
        Update: {
          authority_id?: string | null
          closed_manually_at?: string | null
          created_at?: string
          creator?: string
          description?: string
          end_date?: string
          id?: string
          last_modified_at?: string | null
          last_modified_by?: string | null
          option1?: string
          option2?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "elections_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "election_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_elections_authority"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "election_authorities"
            referencedColumns: ["id"]
          },
        ]
      }
      no_votes: {
        Row: {
          created_at: string
          election_id: string
          id: string
          nullification_count: number
          nullified: boolean
          updated_at: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          election_id: string
          id?: string
          nullification_count?: number
          nullified?: boolean
          updated_at?: string
          voter_id: string
        }
        Update: {
          created_at?: string
          election_id?: string
          id?: string
          nullification_count?: number
          nullified?: boolean
          updated_at?: string
          voter_id?: string
        }
        Relationships: []
      }
      nullification_accumulators: {
        Row: {
          acc_c1_x: string
          acc_c1_y: string
          acc_c2_x: string
          acc_c2_y: string
          created_at: string
          election_id: string
          id: string
          updated_at: string
          version: number
          voter_id: string
        }
        Insert: {
          acc_c1_x: string
          acc_c1_y: string
          acc_c2_x: string
          acc_c2_y: string
          created_at?: string
          election_id: string
          id?: string
          updated_at?: string
          version?: number
          voter_id: string
        }
        Update: {
          acc_c1_x?: string
          acc_c1_y?: string
          acc_c2_x?: string
          acc_c2_y?: string
          created_at?: string
          election_id?: string
          id?: string
          updated_at?: string
          version?: number
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nullification_accumulators_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      nullifications: {
        Row: {
          created_at: string
          election_id: string
          id: string
          nullifier_ciphertext: Json
          nullifier_zkp: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          election_id: string
          id?: string
          nullifier_ciphertext: Json
          nullifier_zkp?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          election_id?: string
          id?: string
          nullifier_ciphertext?: Json
          nullifier_zkp?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nullifications_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          choice: string
          created_at: string
          election_id: string
          id: string
          nullifier: string | null
          signature: string
          timestamp: number
          voter: string
        }
        Insert: {
          choice: string
          created_at?: string
          election_id: string
          id?: string
          nullifier?: string | null
          signature: string
          timestamp: number
          voter: string
        }
        Update: {
          choice?: string
          created_at?: string
          election_id?: string
          id?: string
          nullifier?: string | null
          signature?: string
          timestamp?: number
          voter?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      world_id_auth_verifiers: {
        Row: {
          created_at: string
          nullifier_hash: string
          updated_at: string
          verifier_hash: string
        }
        Insert: {
          created_at?: string
          nullifier_hash: string
          updated_at?: string
          verifier_hash: string
        }
        Update: {
          created_at?: string
          nullifier_hash?: string
          updated_at?: string
          verifier_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_id_auth_verifiers_nullifier_hash_fkey"
            columns: ["nullifier_hash"]
            isOneToOne: true
            referencedRelation: "world_id_keypairs"
            referencedColumns: ["nullifier_hash"]
          },
        ]
      }
      world_id_keypairs: {
        Row: {
          created_at: string
          id: string
          nullifier_hash: string
          public_key_x: string
          public_key_y: string
        }
        Insert: {
          created_at?: string
          id?: string
          nullifier_hash: string
          public_key_x: string
          public_key_y: string
        }
        Update: {
          created_at?: string
          id?: string
          nullifier_hash?: string
          public_key_x?: string
          public_key_y?: string
        }
        Relationships: []
      }
      world_id_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_used_at: string
          nullifier_hash: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string
          nullifier_hash: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          nullifier_hash?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_id_sessions_nullifier_hash_fkey"
            columns: ["nullifier_hash"]
            isOneToOne: false
            referencedRelation: "world_id_keypairs"
            referencedColumns: ["nullifier_hash"]
          },
        ]
      }
      yes_votes: {
        Row: {
          created_at: string
          election_id: string
          id: string
          nullification_count: number
          nullified: boolean
          updated_at: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          election_id: string
          id?: string
          nullification_count?: number
          nullified?: boolean
          updated_at?: string
          voter_id: string
        }
        Update: {
          created_at?: string
          election_id?: string
          id?: string
          nullification_count?: number
          nullified?: boolean
          updated_at?: string
          voter_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_authority_audit_events: {
        Row: {
          action: string | null
          election_id: string | null
          id: string | null
          performed_at: string | null
          performed_by: string | null
        }
        Relationships: []
      }
      public_delegations: {
        Row: {
          created_at: string | null
          delegate_ct_c1_x: string | null
          delegate_ct_c1_y: string | null
          delegate_ct_c2_x: string | null
          delegate_ct_c2_y: string | null
          delegator_pseudonym: string | null
          election_id: string | null
          id: string | null
          revoked_at: string | null
          status: string | null
        }
        Relationships: []
      }
      public_election_authorities: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          public_key_x: string | null
          public_key_y: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_elections: {
        Row: {
          authority_id: string | null
          closed_manually_at: string | null
          created_at: string | null
          creator: string | null
          description: string | null
          end_date: string | null
          id: string | null
          option1: string | null
          option2: string | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      public_nullification_accumulators: {
        Row: {
          acc_c1_x: string | null
          acc_c1_y: string | null
          acc_c2_x: string | null
          acc_c2_y: string | null
          created_at: string | null
          election_id: string | null
          id: string | null
          updated_at: string | null
          version: number | null
          voter_pseudonym: string | null
        }
        Relationships: []
      }
      public_nullifications: {
        Row: {
          created_at: string | null
          election_id: string | null
          id: string | null
          nullifier_ciphertext: Json | null
          nullifier_zkp: Json | null
          submitter_pseudonym: string | null
        }
        Relationships: []
      }
      public_participants: {
        Row: {
          election_id: string | null
          id: string | null
          joined_at: string | null
          public_key_x: string | null
          public_key_y: string | null
          voter_pseudonym: string | null
        }
        Relationships: []
      }
      public_votes: {
        Row: {
          accepted_at: string | null
          choice: string | null
          election_id: string | null
          receipt_id: string | null
          signature: string | null
          signed_at: number | null
          voter_pseudonym: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      public_tallies: {
        Row: {
          election_id: string | null
          id: string | null
          nullification_count: number | null
          processed_at: string | null
          tally_run_id: string | null
          vote_nullified: boolean | null
          vote_weight: number | null
          voter_pseudonym: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cast_vote_atomic: {
        Args: {
          p_choice: string
          p_election_id: string
          p_signature: string
          p_timestamp: number
          p_voter: string
        }
        Returns: {
          accepted_at: string
          already_existed: boolean
          receipt_id: string
          recorded_choice: string
          recorded_signature: string
          recorded_timestamp: number
        }[]
      }
      clear_discrete_log_table: { Args: never; Returns: undefined }
      close_election_atomic: {
        Args: { p_election_id: string }
        Returns: boolean
      }
      create_election_atomic: {
        Args: {
          p_authority_id: string
          p_creator: string
          p_description: string
          p_end_date: string
          p_idempotency_key: string
          p_option1: string
          p_option2: string
          p_title: string
        }
        Returns: Database["public"]["Tables"]["elections"]["Row"]
      }
      get_authority_id_for_current_user: { Args: never; Returns: string }
      get_discrete_log: { Args: { point_str: string }; Returns: number }
      initialize_discrete_log_table: {
        Args: { max_value?: number }
        Returns: number
      }
      is_current_user_election_authority: {
        Args: { authority_id_param: string }
        Returns: boolean
      }
      submit_nullification_batch: {
        Args: { p_election_id: string; p_items: Json; p_submitter_id: string }
        Returns: Json
      }
      store_tally_results_atomic: {
        Args: {
          p_election_id: string
          p_processed_by: string
          p_replace_existing?: boolean
          p_results: Json
        }
        Returns: string
      }
      write_delegation_atomic: {
        Args: {
          p_action: string
          p_c1_x?: string | null
          p_c1_y?: string | null
          p_c2_x?: string | null
          p_c2_y?: string | null
          p_delegator_id: string
          p_election_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
