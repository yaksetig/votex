export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
      election_trusted_setups: {
        Row: {
          created_at: string
          created_by: string
          election_id: string
          id: string
          proving_key: Json
          proving_key_filename: string | null
          proving_key_hash: string | null
          verification_key: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          election_id: string
          id?: string
          proving_key: Json
          proving_key_filename?: string | null
          proving_key_hash?: string | null
          verification_key: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          election_id?: string
          id?: string
          proving_key?: Json
          proving_key_filename?: string | null
          proving_key_hash?: string | null
          verification_key?: Json
        }
        Relationships: [
          {
            foreignKeyName: "election_trusted_setups_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: true
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          authority_id: string | null
          created_at: string
          creator: string
          description: string
          end_date: string
          id: string
          option1: string
          option2: string
          title: string
        }
        Insert: {
          authority_id?: string | null
          created_at?: string
          creator: string
          description: string
          end_date: string
          id?: string
          option1?: string
          option2?: string
          title: string
        }
        Update: {
          authority_id?: string | null
          created_at?: string
          creator?: string
          description?: string
          end_date?: string
          id?: string
          option1?: string
          option2?: string
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
        ]
      }
      global_trusted_setups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          proving_key_filename: string
          proving_key_hash: string
          verification_key: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          proving_key_filename: string
          proving_key_hash: string
          verification_key: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          proving_key_filename?: string
          proving_key_hash?: string
          verification_key?: Json
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      insert_vote: {
        Args: {
          p_election_id: string
          p_voter: string
          p_choice: string
          p_nullifier: string
          p_signature: string
          p_timestamp: number
        }
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
