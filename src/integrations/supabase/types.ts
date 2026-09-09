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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      coach_pattern_log: {
        Row: {
          first_detected: string
          last_detected: string
          pattern_type: string
          sessions_with_pattern: number
          total_occurrences: number
          updated_at: string
          user_id: string
        }
        Insert: {
          first_detected?: string
          last_detected?: string
          pattern_type: string
          sessions_with_pattern?: number
          total_occurrences?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          first_detected?: string
          last_detected?: string
          pattern_type?: string
          sessions_with_pattern?: number
          total_occurrences?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_sessions: {
        Row: {
          acceptance_rate: number | null
          created_at: string
          document_id: string | null
          id: string
          milestones: Json
          patterns: Json
          session_end: string | null
          session_focus_areas: string[]
          session_start: string
          tips_accepted: number
          tips_given: number
          tips_skipped: number
          updated_at: string
          user_id: string
        }
        Insert: {
          acceptance_rate?: number | null
          created_at?: string
          document_id?: string | null
          id?: string
          milestones?: Json
          patterns?: Json
          session_end?: string | null
          session_focus_areas?: string[]
          session_start?: string
          tips_accepted?: number
          tips_given?: number
          tips_skipped?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          acceptance_rate?: number | null
          created_at?: string
          document_id?: string | null
          id?: string
          milestones?: Json
          patterns?: Json
          session_end?: string | null
          session_focus_areas?: string[]
          session_start?: string
          tips_accepted?: number
          tips_given?: number
          tips_skipped?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_sessions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_tips_history: {
        Row: {
          category: string
          confidence: number
          created_at: string
          id: string
          pattern_type: string
          session_id: string
          tip_text: string
          user_action: string
          user_id: string
        }
        Insert: {
          category: string
          confidence?: number
          created_at?: string
          id?: string
          pattern_type: string
          session_id: string
          tip_text: string
          user_action: string
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string
          id?: string
          pattern_type?: string
          session_id?: string
          tip_text?: string
          user_action?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_tips_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coach_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          content: Json | null
          created_at: string
          document_id: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          document_id: string
          id?: string
          title?: string
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          document_id?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: Json | null
          created_at: string
          doc_type: Database["public"]["Enums"]["doc_type"]
          id: string
          plagiarism_data: Json | null
          plagiarism_score: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_type"]
          id?: string
          plagiarism_data?: Json | null
          plagiarism_score?: number | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_type"]
          id?: string
          plagiarism_data?: Json | null
          plagiarism_score?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          academic_level: string | null
          coach_enabled: boolean
          coach_focus_areas: string[]
          coach_mode: string
          created_at: string
          custom_instructions: string | null
          display_name: string | null
          field_of_study: string | null
          onboarding_completed: boolean
          updated_at: string
          user_id: string
          writing_tone: string | null
        }
        Insert: {
          academic_level?: string | null
          coach_enabled?: boolean
          coach_focus_areas?: string[]
          coach_mode?: string
          created_at?: string
          custom_instructions?: string | null
          display_name?: string | null
          field_of_study?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
          writing_tone?: string | null
        }
        Update: {
          academic_level?: string | null
          coach_enabled?: boolean
          coach_focus_areas?: string[]
          coach_mode?: string
          created_at?: string
          custom_instructions?: string | null
          display_name?: string | null
          field_of_study?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
          writing_tone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      doc_type: "essay" | "research_paper" | "report" | "general"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      doc_type: ["essay", "research_paper", "report", "general"],
    },
  },
} as const
