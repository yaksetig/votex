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
  public: {
    Tables: {
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
          created_at: string
          description: string | null
          id: string
          name: string
          public_key_x: string
          public_key_y: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          public_key_x: string
          public_key_y: string
          updated_at?: string
        }
        Update: {
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
          details: Json | null
          election_id: string
          id: string
          performed_at: string
          performed_by: string
        }
        Insert: {
          action: string
          details?: Json | null
          election_id: string
          id?: string
          performed_at?: string
          performed_by: string
        }
        Update: {
          action?: string
          details?: Json | null
          election_id?: string
          id?: string
          performed_at?: string
          performed_by?: string
        }
        Relationships: []
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
          user_id: string
          vote_nullified: boolean
        }
        Insert: {
          election_id: string
          id?: string
          nullification_count?: number
          processed_at?: string
          processed_by?: string | null
          user_id: string
          vote_nullified?: boolean
        }
        Update: {
          election_id?: string
          id?: string
          nullification_count?: number
          processed_at?: string
          processed_by?: string | null
          user_id?: string
          vote_nullified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_election_tallies_election_id"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
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
      keypairs: {
        Row: {
          created_at: string
          id: string
          public_key_x: string
          public_key_y: string
        }
        Insert: {
          created_at?: string
          id?: string
          public_key_x: string
          public_key_y: string
        }
        Update: {
          created_at?: string
          id?: string
          public_key_x?: string
          public_key_y?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      clear_discrete_log_table: { Args: never; Returns: undefined }
      get_discrete_log: { Args: { point_str: string }; Returns: number }
      initialize_discrete_log_table: {
        Args: { max_value?: number }
        Returns: number
      }
      insert_vote: {
        Args: {
          p_choice: string
          p_election_id: string
          p_nullifier: string
          p_signature: string
          p_timestamp: number
          p_voter: string
        }
        Returns: boolean
      }
      is_election_authority_for_election: {
        Args: { election_id_param: string }
        Returns: boolean
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
  public: {
    Enums: {},
  },
} as const
