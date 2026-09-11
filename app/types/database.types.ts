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
      audit_events: {
        Row: {
          action: string
          actor_id: string
          after_json: Json | null
          before_json: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          owner_id: string
          reason: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          owner_id: string
          reason?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          owner_id?: string
          reason?: string | null
          request_id?: string | null
        }
        Relationships: []
      }
      borrowers: {
        Row: {
          archived_at: string | null
          created_at: string
          display_name: string
          id: string
          normalized_name: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          display_name: string
          id?: string
          normalized_name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          display_name?: string
          id?: string
          normalized_name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          committed_at: string | null
          counts_json: Json
          created_at: string
          file_sha256: string
          filename: string
          id: string
          mapping_json: Json
          mapping_version: number
          owner_id: string
          result_json: Json | null
          status: Database["public"]["Enums"]["import_batch_status"]
          storage_path: string | null
          updated_at: string
          version: number
        }
        Insert: {
          committed_at?: string | null
          counts_json?: Json
          created_at?: string
          file_sha256: string
          filename: string
          id?: string
          mapping_json?: Json
          mapping_version?: number
          owner_id: string
          result_json?: Json | null
          status?: Database["public"]["Enums"]["import_batch_status"]
          storage_path?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          committed_at?: string | null
          counts_json?: Json
          created_at?: string
          file_sha256?: string
          filename?: string
          id?: string
          mapping_json?: Json
          mapping_version?: number
          owner_id?: string
          result_json?: Json | null
          status?: Database["public"]["Enums"]["import_batch_status"]
          storage_path?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          batch_id: string
          committed_loan_id: string | null
          created_at: string
          decision: Database["public"]["Enums"]["import_row_decision"]
          fingerprint: string
          id: string
          issues_json: Json
          normalized_json: Json | null
          owner_id: string
          raw_json: Json
          resolution_json: Json | null
          row_number: number
          sheet_name: string
        }
        Insert: {
          batch_id: string
          committed_loan_id?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["import_row_decision"]
          fingerprint: string
          id?: string
          issues_json?: Json
          normalized_json?: Json | null
          owner_id: string
          raw_json: Json
          resolution_json?: Json | null
          row_number: number
          sheet_name: string
        }
        Update: {
          batch_id?: string
          committed_loan_id?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["import_row_decision"]
          fingerprint?: string
          id?: string
          issues_json?: Json
          normalized_json?: Json | null
          owner_id?: string
          raw_json?: Json
          resolution_json?: Json | null
          row_number?: number
          sheet_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_owner_id_batch_id_fkey"
            columns: ["owner_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "import_rows_owner_id_committed_loan_id_fkey"
            columns: ["owner_id", "committed_loan_id"]
            isOneToOne: false
            referencedRelation: "loan_summary"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "import_rows_owner_id_committed_loan_id_fkey"
            columns: ["owner_id", "committed_loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      loans: {
        Row: {
          archived_at: string | null
          borrowed_on: string | null
          borrower_id: string
          collection_weekdays: number[]
          created_at: string
          currency: string
          daily_due_centavos: number | null
          due_on: string | null
          id: string
          interest_centavos: number | null
          interest_mode:
            | Database["public"]["Enums"]["loan_interest_mode"]
            | null
          legacy_completed_on: string | null
          legacy_percent_value: number | null
          owner_id: string
          payment_start_on: string | null
          principal_centavos: number | null
          readiness: Database["public"]["Enums"]["loan_readiness"]
          source_import_row_id: string | null
          source_sequence: number | null
          total_payable_centavos: number | null
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          borrowed_on?: string | null
          borrower_id: string
          collection_weekdays?: number[]
          created_at?: string
          currency?: string
          daily_due_centavos?: number | null
          due_on?: string | null
          id?: string
          interest_centavos?: number | null
          interest_mode?:
            | Database["public"]["Enums"]["loan_interest_mode"]
            | null
          legacy_completed_on?: string | null
          legacy_percent_value?: number | null
          owner_id: string
          payment_start_on?: string | null
          principal_centavos?: number | null
          readiness?: Database["public"]["Enums"]["loan_readiness"]
          source_import_row_id?: string | null
          source_sequence?: number | null
          total_payable_centavos?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          borrowed_on?: string | null
          borrower_id?: string
          collection_weekdays?: number[]
          created_at?: string
          currency?: string
          daily_due_centavos?: number | null
          due_on?: string | null
          id?: string
          interest_centavos?: number | null
          interest_mode?:
            | Database["public"]["Enums"]["loan_interest_mode"]
            | null
          legacy_completed_on?: string | null
          legacy_percent_value?: number | null
          owner_id?: string
          payment_start_on?: string | null
          principal_centavos?: number | null
          readiness?: Database["public"]["Enums"]["loan_readiness"]
          source_import_row_id?: string | null
          source_sequence?: number | null
          total_payable_centavos?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "loans_owner_id_borrower_id_fkey"
            columns: ["owner_id", "borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "loans_source_import_row_fk"
            columns: ["owner_id", "source_import_row_id"]
            isOneToOne: false
            referencedRelation: "import_rows"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      mutation_requests: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          operation: string
          owner_id: string
          payload_hash: string
          response_json: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          operation: string
          owner_id: string
          payload_hash: string
          response_json?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          operation?: string
          owner_id?: string
          payload_hash?: string
          response_json?: Json | null
        }
        Relationships: []
      }
      opening_balances: {
        Row: {
          as_of: string
          collected_centavos: number
          confirmed_by: string
          created_at: string
          id: string
          loan_id: string
          owner_id: string
          reason: string
          supersedes_id: string | null
        }
        Insert: {
          as_of: string
          collected_centavos: number
          confirmed_by: string
          created_at?: string
          id?: string
          loan_id: string
          owner_id: string
          reason: string
          supersedes_id?: string | null
        }
        Update: {
          as_of?: string
          collected_centavos?: number
          confirmed_by?: string
          created_at?: string
          id?: string
          loan_id?: string
          owner_id?: string
          reason?: string
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_balances_owner_id_loan_id_fkey"
            columns: ["owner_id", "loan_id"]
            isOneToOne: false
            referencedRelation: "loan_summary"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "opening_balances_owner_id_loan_id_fkey"
            columns: ["owner_id", "loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "opening_balances_owner_id_supersedes_id_fkey"
            columns: ["owner_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "opening_balances"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      payment_entries: {
        Row: {
          amount_centavos: number
          created_at: string
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["payment_kind"]
          loan_id: string
          method: string | null
          note: string | null
          owner_id: string
          paid_on: string
          reverses_id: string | null
        }
        Insert: {
          amount_centavos: number
          created_at?: string
          id?: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["payment_kind"]
          loan_id: string
          method?: string | null
          note?: string | null
          owner_id: string
          paid_on: string
          reverses_id?: string | null
        }
        Update: {
          amount_centavos?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          loan_id?: string
          method?: string | null
          note?: string | null
          owner_id?: string
          paid_on?: string
          reverses_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_entries_owner_id_loan_id_fkey"
            columns: ["owner_id", "loan_id"]
            isOneToOne: false
            referencedRelation: "loan_summary"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "payment_entries_owner_id_loan_id_fkey"
            columns: ["owner_id", "loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "payment_entries_owner_id_reverses_id_fkey"
            columns: ["owner_id", "reverses_id"]
            isOneToOne: false
            referencedRelation: "payment_entries"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          default_collection_weekdays: number[]
          id: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          currency?: string
          default_collection_weekdays?: number[]
          id: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          currency?: string
          default_collection_weekdays?: number[]
          id?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      loan_summary: {
        Row: {
          archived_at: string | null
          borrowed_on: string | null
          borrower_archived_at: string | null
          borrower_display_name: string | null
          borrower_id: string | null
          borrower_normalized_name: string | null
          borrower_version: number | null
          collection_weekdays: number[] | null
          completed_on: string | null
          created_at: string | null
          currency: string | null
          daily_due_centavos: number | null
          display_status: string | null
          due_on: string | null
          id: string | null
          interest_centavos: number | null
          interest_mode:
            | Database["public"]["Enums"]["loan_interest_mode"]
            | null
          legacy_completed_on: string | null
          legacy_percent_value: number | null
          net_payments_centavos: number | null
          opening_collected_centavos: number | null
          owner_id: string | null
          payment_start_on: string | null
          principal_centavos: number | null
          progress_pct: number | null
          readiness: Database["public"]["Enums"]["loan_readiness"] | null
          recognized_collected_centavos: number | null
          remaining_centavos: number | null
          source_import_row_id: string | null
          source_sequence: number | null
          total_payable_centavos: number | null
          updated_at: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_owner_id_borrower_id_fkey"
            columns: ["owner_id", "borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "loans_source_import_row_fk"
            columns: ["owner_id", "source_import_row_id"]
            isOneToOne: false
            referencedRelation: "import_rows"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
    }
    Functions: {
      commit_import: { Args: { p_batch_id: string }; Returns: undefined }
      confirm_opening_balance: {
        Args: {
          p_as_of: string
          p_collected_centavos: number
          p_loan_id: string
          p_reason: string
        }
        Returns: {
          archived_at: string | null
          borrowed_on: string | null
          borrower_archived_at: string | null
          borrower_display_name: string | null
          borrower_id: string | null
          borrower_normalized_name: string | null
          borrower_version: number | null
          collection_weekdays: number[] | null
          completed_on: string | null
          created_at: string | null
          currency: string | null
          daily_due_centavos: number | null
          display_status: string | null
          due_on: string | null
          id: string | null
          interest_centavos: number | null
          interest_mode:
            | Database["public"]["Enums"]["loan_interest_mode"]
            | null
          legacy_completed_on: string | null
          legacy_percent_value: number | null
          net_payments_centavos: number | null
          opening_collected_centavos: number | null
          owner_id: string | null
          payment_start_on: string | null
          principal_centavos: number | null
          progress_pct: number | null
          readiness: Database["public"]["Enums"]["loan_readiness"] | null
          recognized_collected_centavos: number | null
          remaining_centavos: number | null
          source_import_row_id: string | null
          source_sequence: number | null
          total_payable_centavos: number | null
          updated_at: string | null
          version: number | null
        }
        SetofOptions: {
          from: "*"
          to: "loan_summary"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_payment: {
        Args: {
          p_amount_centavos: number
          p_idempotency_key: string
          p_loan_id: string
          p_method: string
          p_note: string
          p_paid_on: string
        }
        Returns: {
          archived_at: string | null
          borrowed_on: string | null
          borrower_archived_at: string | null
          borrower_display_name: string | null
          borrower_id: string | null
          borrower_normalized_name: string | null
          borrower_version: number | null
          collection_weekdays: number[] | null
          completed_on: string | null
          created_at: string | null
          currency: string | null
          daily_due_centavos: number | null
          display_status: string | null
          due_on: string | null
          id: string | null
          interest_centavos: number | null
          interest_mode:
            | Database["public"]["Enums"]["loan_interest_mode"]
            | null
          legacy_completed_on: string | null
          legacy_percent_value: number | null
          net_payments_centavos: number | null
          opening_collected_centavos: number | null
          owner_id: string | null
          payment_start_on: string | null
          principal_centavos: number | null
          progress_pct: number | null
          readiness: Database["public"]["Enums"]["loan_readiness"] | null
          recognized_collected_centavos: number | null
          remaining_centavos: number | null
          source_import_row_id: string | null
          source_sequence: number | null
          total_payable_centavos: number | null
          updated_at: string | null
          version: number | null
        }
        SetofOptions: {
          from: "*"
          to: "loan_summary"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_payment: {
        Args: {
          p_idempotency_key: string
          p_payment_id: string
          p_reason: string
        }
        Returns: {
          archived_at: string | null
          borrowed_on: string | null
          borrower_archived_at: string | null
          borrower_display_name: string | null
          borrower_id: string | null
          borrower_normalized_name: string | null
          borrower_version: number | null
          collection_weekdays: number[] | null
          completed_on: string | null
          created_at: string | null
          currency: string | null
          daily_due_centavos: number | null
          display_status: string | null
          due_on: string | null
          id: string | null
          interest_centavos: number | null
          interest_mode:
            | Database["public"]["Enums"]["loan_interest_mode"]
            | null
          legacy_completed_on: string | null
          legacy_percent_value: number | null
          net_payments_centavos: number | null
          opening_collected_centavos: number | null
          owner_id: string | null
          payment_start_on: string | null
          principal_centavos: number | null
          progress_pct: number | null
          readiness: Database["public"]["Enums"]["loan_readiness"] | null
          recognized_collected_centavos: number | null
          remaining_centavos: number | null
          source_import_row_id: string | null
          source_sequence: number | null
          total_payable_centavos: number | null
          updated_at: string | null
          version: number | null
        }
        SetofOptions: {
          from: "*"
          to: "loan_summary"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      import_batch_status:
        | "uploaded"
        | "previewed"
        | "committed"
        | "failed"
        | "cancelled"
      import_row_decision: "pending" | "include" | "exclude"
      loan_interest_mode: "none" | "added" | "included"
      loan_readiness: "needs_review" | "ready"
      payment_kind: "payment" | "reversal"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      import_batch_status: [
        "uploaded",
        "previewed",
        "committed",
        "failed",
        "cancelled",
      ],
      import_row_decision: ["pending", "include", "exclude"],
      loan_interest_mode: ["none", "added", "included"],
      loan_readiness: ["needs_review", "ready"],
      payment_kind: ["payment", "reversal"],
    },
  },
} as const
