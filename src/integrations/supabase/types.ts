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
          occasion: string | null
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
          occasion?: string | null
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
          occasion?: string | null
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
          guest_access_token_hash: string | null
          id: string
          items: Json
          order_type: string | null
          paid_at: string | null
          paid_by: string | null
          payment_status: string
          status: string
          table_number: string | null
          table_session_id: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          arrival_code?: string | null
          arrival_verified_at?: string | null
          created_at?: string
          eta_minutes?: number | null
          eta_set_at?: string | null
          guest_access_token_hash?: string | null
          id?: string
          items: Json
          order_type?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_status?: string
          status?: string
          table_number?: string | null
          table_session_id?: string | null
          total: number
          user_id?: string | null
        }
        Update: {
          arrival_code?: string | null
          arrival_verified_at?: string | null
          created_at?: string
          eta_minutes?: number | null
          eta_set_at?: string | null
          guest_access_token_hash?: string | null
          id?: string
          items?: Json
          order_type?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_status?: string
          status?: string
          table_number?: string | null
          table_session_id?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          changed_by_role: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          event_key: string
          event_type: string
          id: string
          metadata: Json
          order_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          metadata?: Json
          order_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          read_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          events_updates: boolean
          order_updates: boolean
          push_enabled: boolean
          rewards_updates: boolean
          service_updates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          events_updates?: boolean
          order_updates?: boolean
          push_enabled?: boolean
          rewards_updates?: boolean
          service_updates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          events_updates?: boolean
          order_updates?: boolean
          push_enabled?: boolean
          rewards_updates?: boolean
          service_updates?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          active: boolean
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      food_reviews: {
        Row: {
          comment: string | null
          created_at: string
          editable_until: string
          id: string
          menu_item_id: string
          menu_item_name: string
          order_id: string
          photo_url: string | null
          private_issue_note: string | null
          rating: number
          reviewer_name: string
          staff_responded_at: string | null
          staff_responded_by: string | null
          staff_response: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      loyalty_rules: {
        Row: {
          award_on_reservation_arrival: boolean
          enabled: boolean
          excluded_categories: string[]
          excluded_item_ids: string[]
          id: number
          min_qualifying_nad: number
          points_expiry_days: number | null
          points_per_nad: number
          reservation_bonus_points: number
          updated_at: string
          updated_by: string | null
        }
        Insert: never
        Update: Partial<Database["public"]["Tables"]["loyalty_rules"]["Row"]>
        Relationships: []
      }
      loyalty_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          entry_type: string
          expires_at: string | null
          id: string
          idempotency_key: string
          note: string | null
          order_id: string | null
          points: number
          redemption_id: string | null
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      rewards_catalog: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          points_cost: number
          terms: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          description?: string | null
          expires_at?: string | null
          points_cost: number
          terms?: string | null
          title: string
        }
        Update: {
          active?: boolean
          category?: string
          description?: string | null
          expires_at?: string | null
          points_cost?: number
          terms?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          points_spent: number
          redemption_code: string
          reward_id: string
          source: string
          status: string
          used_at: string | null
          used_by: string | null
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      guest_of_the_week: {
        Row: {
          approved_by: string | null
          approved_display_name: string
          approved_photo_url: string | null
          consented_at: string | null
          created_at: string
          id: string
          photo_consent: boolean
          recognition_message: string
          reward_id: string | null
          reward_redemption_id: string | null
          score_breakdown: Json
          social_consent: boolean
          status: string
          updated_at: string
          user_id: string
          week_start: string
          withdrawn_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          active: boolean
          area: string
          capacity: number
          created_at: string
          display_name: string
          id: string
          qr_version: number
          table_code: string
          table_number: string
          updated_at: string
        }
        Insert: never
        Update: {
          active?: boolean
          area?: string
          capacity?: number
          display_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          expires_at: string
          id: string
          opened_at: string
          opened_by: string | null
          session_token_hash: string
          status: string
          table_id: string
          verified_by_staff: boolean
        }
        Insert: never
        Update: never
        Relationships: []
      }
      service_requests: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          cancelled_at: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          guest_session_key: string | null
          id: string
          note: string | null
          request_type: string
          status: string
          table_id: string
          table_session_id: string
          user_id: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      group_orders: {
        Row: {
          created_at: string
          host_guest_key: string | null
          host_user_id: string | null
          id: string
          idempotency_key: string | null
          invite_code: string
          invite_expires_at: string
          status: string
          submitted_order_id: string | null
          table_display_name: string
          table_id: string
          table_session_id: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      group_participants: {
        Row: {
          display_name: string
          group_order_id: string
          guest_session_key: string | null
          id: string
          joined_at: string
          left_at: string | null
          role: string
          user_id: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      group_order_items: {
        Row: {
          created_at: string
          group_order_id: string
          id: string
          item_name: string
          locked: boolean
          menu_item_id: string
          modifiers: Json
          note: string | null
          participant_id: string
          quantity: number
          unit_price_cents: number
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      bill_allocations: {
        Row: {
          amount_cents: number
          bill_total_cents: number
          created_at: string
          group_order_id: string
          id: string
          note: string | null
          participant_id: string
          payment_status: string
          settled_at: string | null
          settled_by: string | null
          settlement_reference: string | null
          split_method: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      bill_settlements: {
        Row: {
          allocation_id: string
          amount_cents: number
          created_at: string
          group_order_id: string
          id: string
          method: string
          recorded_by: string
          reference: string | null
        }
        Insert: never
        Update: never
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
      private_dining_feedback: {
        Row: {
          category: string
          created_at: string
          guest_name: string | null
          guest_phone: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          order_id: string | null
          staff_note: string | null
          status: string
          table_label: string | null
          table_session_id: string | null
          user_id: string | null
          wants_manager_visit: boolean
        }
        Insert: {
          category?: string
          created_at?: string
          guest_name?: string | null
          guest_phone?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message: string
          order_id?: string | null
          staff_note?: string | null
          status?: string
          table_label?: string | null
          table_session_id?: string | null
          user_id?: string | null
          wants_manager_visit?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          guest_name?: string | null
          guest_phone?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          order_id?: string | null
          staff_note?: string | null
          status?: string
          table_label?: string | null
          table_session_id?: string | null
          user_id?: string | null
          wants_manager_visit?: boolean
        }
        Relationships: []
      }
      user_dining_preferences: {
        Row: {
          dietary_preferences: string[]
          preferred_doneness: string | null
          preferred_side: string | null
          updated_at: string
          user_id: string
          usual_items: Json
        }
        Insert: {
          dietary_preferences?: string[]
          preferred_doneness?: string | null
          preferred_side?: string | null
          updated_at?: string
          user_id: string
          usual_items?: Json
        }
        Update: {
          dietary_preferences?: string[]
          preferred_doneness?: string | null
          preferred_side?: string | null
          updated_at?: string
          user_id?: string
          usual_items?: Json
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
      app_role: "admin" | "manager" | "kitchen" | "waiter" | "moderator" | "user"
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
      app_role: ["admin", "manager", "kitchen", "waiter", "moderator", "user"],
    },
  },
} as const
