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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          amount: number | null
          category: string | null
          confidence: string | null
          created_at: string
          currency: string | null
          id: string
          note: string | null
          project_id: string
          quantity: number | null
          region: string | null
          search_query: string | null
          source_document_id: string | null
          source_page: string | null
          text: string
          unit: string | null
          unit_type: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          confidence?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          note?: string | null
          project_id: string
          quantity?: number | null
          region?: string | null
          search_query?: string | null
          source_document_id?: string | null
          source_page?: string | null
          text: string
          unit?: string | null
          unit_type?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          confidence?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          note?: string | null
          project_id?: string
          quantity?: number | null
          region?: string | null
          search_query?: string | null
          source_document_id?: string | null
          source_page?: string | null
          text?: string
          unit?: string | null
          unit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_evaluations: {
        Row: {
          by_region: Json
          created_at: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          by_region?: Json
          created_at?: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          by_region?: Json
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          file_type: string
          filename: string
          id: string
          project_id: string
          status: string
          storage_path: string | null
          uploaded_at: string
        }
        Insert: {
          file_type?: string
          filename: string
          id?: string
          project_id: string
          status?: string
          storage_path?: string | null
          uploaded_at?: string
        }
        Update: {
          file_type?: string
          filename?: string
          id?: string
          project_id?: string
          status?: string
          storage_path?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          activity_id: string
          co2e_kg: number
          confidence: number
          created_at: string
          id: string
          input_used: Json
          matched_factor: Json
          project_id: string
          region: string | null
        }
        Insert: {
          activity_id: string
          co2e_kg?: number
          confidence?: number
          created_at?: string
          id?: string
          input_used?: Json
          matched_factor?: Json
          project_id: string
          region?: string | null
        }
        Update: {
          activity_id?: string
          co2e_kg?: number
          confidence?: number
          created_at?: string
          id?: string
          input_used?: Json
          matched_factor?: Json
          project_id?: string
          region?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          progress: number
          project_id: string
          result: Json | null
          stage: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          progress?: number
          project_id: string
          result?: Json | null
          stage?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          progress?: number
          project_id?: string
          result?: Json | null
          stage?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          id: string
          is_pro: boolean
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_pro?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_pro?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          baseline_footprint_kg_co2e: number | null
          company_type: string
          comparison_regions: string[]
          created_at: string
          id: string
          name: string
          primary_region: string
          updated_at: string
          user_id: string | null
          year: number
        }
        Insert: {
          baseline_footprint_kg_co2e?: number | null
          company_type?: string
          comparison_regions?: string[]
          created_at?: string
          id?: string
          name: string
          primary_region?: string
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Update: {
          baseline_footprint_kg_co2e?: number | null
          company_type?: string
          comparison_regions?: string[]
          created_at?: string
          id?: string
          name?: string
          primary_region?: string
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          constraints: string[] | null
          created_at: string
          expected_delta_kg: number
          id: string
          project_id: string
          strategy_draft_text: string
          summary: string
          title: string
        }
        Insert: {
          constraints?: string[] | null
          created_at?: string
          expected_delta_kg?: number
          id?: string
          project_id: string
          strategy_draft_text?: string
          summary: string
          title: string
        }
        Update: {
          constraints?: string[] | null
          created_at?: string
          expected_delta_kg?: number
          id?: string
          project_id?: string
          strategy_draft_text?: string
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_estimates: {
        Row: {
          activity_id: string
          co2e_kg: number
          confidence: number
          created_at: string
          id: string
          input_used: Json
          matched_factor: Json
          project_id: string
          region: string | null
          simulation_region: string
        }
        Insert: {
          activity_id: string
          co2e_kg?: number
          confidence?: number
          created_at?: string
          id?: string
          input_used?: Json
          matched_factor?: Json
          project_id: string
          region?: string | null
          simulation_region: string
        }
        Update: {
          activity_id?: string
          co2e_kg?: number
          confidence?: number
          created_at?: string
          id?: string
          input_used?: Json
          matched_factor?: Json
          project_id?: string
          region?: string | null
          simulation_region?: string
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
