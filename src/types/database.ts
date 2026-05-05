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
      activities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          lead_id: string
          tenant_id: string | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          tenant_id?: string | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          tenant_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          id: string
          requester_id: string
          tenant_id: string | null
          kind: Database["public"]["Enums"]["approval_kind"]
          payload: Json
          reason: string | null
          status: Database["public"]["Enums"]["approval_status"]
          decided_by: string | null
          decided_at: string | null
          decision_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          tenant_id?: string | null
          kind: Database["public"]["Enums"]["approval_kind"]
          payload?: Json
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          decided_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          tenant_id?: string | null
          kind?: Database["public"]["Enums"]["approval_kind"]
          payload?: Json
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          decided_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          id: string
          tenant_id: string
          code: string
          expires_at: string
          is_active: boolean | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          code: string
          expires_at: string
          is_active?: boolean | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          code?: string
          expires_at?: string
          is_active?: boolean | null
          created_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          budget: number
          created_at: string
          email: string | null
          hot: boolean
          id: string
          last_activity_at: string
          name: string
          notes: string | null
          phone: string | null
          property_interest: string | null
          requirements: Json | null
          score: number
          source: Database["public"]["Enums"]["lead_source"]
          stage: Database["public"]["Enums"]["lead_stage"]
          tags: string[]
          team_id: string | null
          tenant_id: string | null
          updated_at: string
          utm_source: string | null
        }
        Insert: {
          assigned_to?: string | null
          budget?: number
          created_at?: string
          email?: string | null
          hot?: boolean
          id?: string
          last_activity_at?: string
          name: string
          notes?: string | null
          phone?: string | null
          property_interest?: string | null
          requirements?: Json | null
          score?: number
          source?: Database["public"]["Enums"]["lead_source"]
          stage?: Database["public"]["Enums"]["lead_stage"]
          tags?: string[]
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          utm_source?: string | null
        }
        Update: {
          assigned_to?: string | null
          budget?: number
          created_at?: string
          email?: string | null
          hot?: boolean
          id?: string
          last_activity_at?: string
          name?: string
          notes?: string | null
          phone?: string | null
          property_interest?: string | null
          requirements?: Json | null
          score?: number
          source?: Database["public"]["Enums"]["lead_source"]
          stage?: Database["public"]["Enums"]["lead_stage"]
          tags?: string[]
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_property_interest"
            columns: ["property_interest"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string
          email: string
          id: string
          initials: string
          name: string
          team_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          email: string
          id: string
          initials?: string
          name?: string
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          email?: string
          id?: string
          initials?: string
          name?: string
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          area: number
          bathrooms: number
          bedrooms: number
          created_at: string
          developer: string | null
          id: string
          image: string | null
          location: string
          price: number
          status: Database["public"]["Enums"]["property_status"]
          tenant_id: string | null
          title: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
        }
        Insert: {
          area?: number
          bathrooms?: number
          bedrooms?: number
          created_at?: string
          developer?: string | null
          id?: string
          image?: string | null
          location: string
          price?: number
          status?: Database["public"]["Enums"]["property_status"]
          tenant_id?: string | null
          title: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Update: {
          area?: number
          bathrooms?: number
          bedrooms?: number
          created_at?: string
          developer?: string | null
          id?: string
          image?: string | null
          location?: string
          price?: number
          status?: Database["public"]["Enums"]["property_status"]
          tenant_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          created_at: string
          description: string | null
          due_at: string
          id: string
          lead_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          created_at?: string
          description?: string | null
          due_at: string
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          created_at?: string
          description?: string | null
          due_at?: string
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          leader_id: string | null
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id: string
          leader_id?: string | null
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string | null
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          seats: number
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          plan?: string
          seats?: number
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          seats?: number
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "call"
        | "note"
        | "email"
        | "whatsapp"
        | "stage_change"
        | "appointment"
        | "task"
      app_role: "super_admin" | "manager" | "leader" | "agent"
      appointment_status: "scheduled" | "completed" | "cancelled" | "no_show"
      approval_kind: "email" | "password" | "role"
      approval_status: "pending" | "approved" | "rejected"
      lead_source:
        | "widget"
        | "manual"
        | "referral"
        | "facebook"
        | "google"
        | "import"
      lead_stage:
        | "new"
        | "contacted"
        | "qualified"
        | "viewing"
        | "negotiation"
        | "won"
        | "lost"
      property_status: "available" | "reserved" | "sold"
      property_type: "apartment" | "villa" | "townhouse" | "office" | "land"
      task_priority: "low" | "medium" | "high"
      task_status: "open" | "in_progress" | "done"
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
    Enums: {
      activity_type: [
        "call",
        "note",
        "email",
        "whatsapp",
        "stage_change",
        "appointment",
        "task",
      ],
      app_role: ["super_admin", "manager", "leader", "agent"],
      appointment_status: ["scheduled", "completed", "cancelled", "no_show"],
      approval_kind: ["email", "password", "role"],
      approval_status: ["pending", "approved", "rejected"],
      lead_source: [
        "widget",
        "manual",
        "referral",
        "facebook",
        "google",
        "import",
      ],
      lead_stage: [
        "new",
        "contacted",
        "qualified",
        "viewing",
        "negotiation",
        "won",
        "lost",
      ],
      property_status: ["available", "reserved", "sold"],
      property_type: ["apartment", "villa", "townhouse", "office", "land"],
      task_priority: ["low", "medium", "high"],
      task_status: ["open", "in_progress", "done"],
    },
  },
} as const
