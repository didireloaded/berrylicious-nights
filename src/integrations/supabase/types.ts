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
      bookings: {
        Row: {
          arrival_code: string | null
          arrival_verified_at: string | null
          assigned_table_code: string | null
          created_at: string
          date: string
          guest_name: string | null
          guest_phone: string | null
          guests: number
          id: string
          pre_order: Json | null
          special_requests: string | null
          status: string
          time: string
          user_id: string | null
        }
        Insert: {
          arrival_code?: string | null
          arrival_verified_at?: string | null
          assigned_table_code?: string | null
          created_at?: string
          date: string
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number
          id?: string
          pre_order?: Json | null
          special_requests?: string | null
          status?: string
          time: string
          user_id?: string | null
        }
        Update: {
          arrival_code?: string | null
          arrival_verified_at?: string | null
          assigned_table_code?: string | null
          created_at?: string
          date?: string
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number
          id?: string
          pre_order?: Json | null
          special_requests?: string | null
          status?: string
          time?: string
          user_id?: string | null
        }
        Relationships: []
      }
      menu_item_disabled: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          arrival_code: string | null
          arrival_verified_at: string | null
          created_at: string
          eta_minutes: number | null
          eta_set_at: string | null
          id: string
          items: Json
          order_type: string | null
          status: string
          total: number
          user_id: string | null
        }
        Insert: {
          arrival_code?: string | null
          arrival_verified_at?: string | null
          created_at?: string
          eta_minutes?: number | null
          eta_set_at?: string | null
          id?: string
          items: Json
          order_type?: string | null
          status?: string
          total: number
          user_id?: string | null
        }
        Update: {
          arrival_code?: string | null
          arrival_verified_at?: string | null
          created_at?: string
          eta_minutes?: number | null
          eta_set_at?: string | null
          id?: string
          items?: Json
          order_type?: string | null
          status?: string
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          favorite_items: string[] | null
          id: string
          last_order: Json | null
          phone: string | null
          total_orders: number
          total_visits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          favorite_items?: string[] | null
          id?: string
          last_order?: Json | null
          phone?: string | null
          total_orders?: number
          total_visits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          favorite_items?: string[] | null
          id?: string
          last_order?: Json | null
          phone?: string | null
          total_orders?: number
          total_visits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurant_chat_messages: {
        Row: {
          author_id: string
          body: string
          chat_id: string
          created_at: string
          from_staff: boolean
          id: string
        }
        Insert: {
          author_id: string
          body: string
          chat_id: string
          created_at?: string
          from_staff?: boolean
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          chat_id?: string
          created_at?: string
          from_staff?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "restaurant_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_chats: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shift_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          report_date: string
          report_type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          report_date: string
          report_type?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          report_date?: string
          report_type?: string
        }
        Relationships: []
      }
      updates: {
        Row: {
          active: boolean
          available_slots: string[] | null
          created_at: string
          event_date: string | null
          event_time: string | null
          expires_at: string | null
          id: string
          subtitle: string | null
          title: string
          type: string
        }
        Insert: {
          active?: boolean
          available_slots?: string[] | null
          created_at?: string
          event_date?: string | null
          event_time?: string | null
          expires_at?: string | null
          id?: string
          subtitle?: string | null
          title: string
          type?: string
        }
        Update: {
          active?: boolean
          available_slots?: string[] | null
          created_at?: string
          event_date?: string | null
          event_time?: string | null
          expires_at?: string | null
          id?: string
          subtitle?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          created_at: string
          guest_name: string | null
          guest_phone: string | null
          id: string
          party_size: number
          preferred_date: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          party_size?: number
          preferred_date: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          party_size?: number
          preferred_date?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
