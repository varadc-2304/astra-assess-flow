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
      answers: {
        Row: {
          code_solution: string | null
          created_at: string | null
          id: string
          is_correct: boolean | null
          language: string | null
          marks_obtained: number
          mcq_option_id: string | null
          question_id: string
          submission_id: string
          test_results: Json | null
        }
        Insert: {
          code_solution?: string | null
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          language?: string | null
          marks_obtained?: number
          mcq_option_id?: string | null
          question_id: string
          submission_id: string
          test_results?: Json | null
        }
        Update: {
          code_solution?: string | null
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          language?: string | null
          marks_obtained?: number
          mcq_option_id?: string | null
          question_id?: string
          submission_id?: string
          test_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_mcq_option_id_fkey"
            columns: ["mcq_option_id"]
            isOneToOne: false
            referencedRelation: "mcq_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          duration_minutes: number
          end_time: string | null
          id: string
          instructions: string | null
          name: string
          reattempt: boolean
          start_time: string
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number
          end_time?: string | null
          id?: string
          instructions?: string | null
          name: string
          reattempt?: boolean
          start_time: string
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number
          end_time?: string | null
          id?: string
          instructions?: string | null
          name?: string
          reattempt?: boolean
          start_time?: string
        }
        Relationships: []
      }
      coding_examples: {
        Row: {
          created_at: string | null
          explanation: string | null
          id: string
          input: string
          order_index: number
          output: string
          question_id: string
        }
        Insert: {
          created_at?: string | null
          explanation?: string | null
          id?: string
          input: string
          order_index: number
          output: string
          question_id: string
        }
        Update: {
          created_at?: string | null
          explanation?: string | null
          id?: string
          input?: string
          order_index?: number
          output?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_examples_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_questions: {
        Row: {
          constraints: string[] | null
          created_at: string | null
          id: string
          question_id: string
          solution_template: Json
        }
        Insert: {
          constraints?: string[] | null
          created_at?: string | null
          id?: string
          question_id: string
          solution_template?: Json
        }
        Update: {
          constraints?: string[] | null
          created_at?: string | null
          id?: string
          question_id?: string
          solution_template?: Json
        }
        Relationships: [
          {
            foreignKeyName: "coding_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      mcq_options: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean
          order_index: number
          question_id: string
          text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          order_index: number
          question_id: string
          text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          order_index?: number
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcq_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          assessment_id: string
          created_at: string | null
          description: string
          id: string
          image_url: string | null
          marks: number
          order_index: number
          title: string
          type: string
        }
        Insert: {
          assessment_id: string
          created_at?: string | null
          description: string
          id?: string
          image_url?: string | null
          marks?: number
          order_index: number
          title: string
          type: string
        }
        Update: {
          assessment_id?: string
          created_at?: string | null
          description?: string
          id?: string
          image_url?: string | null
          marks?: number
          order_index?: number
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          assessment_id: string
          completed_at: string
          created_at: string | null
          id: string
          percentage: number
          total_marks: number
          total_score: number
          user_id: string
        }
        Insert: {
          assessment_id: string
          completed_at: string
          created_at?: string | null
          id?: string
          percentage?: number
          total_marks?: number
          total_score?: number
          user_id: string
        }
        Update: {
          assessment_id?: string
          completed_at?: string
          created_at?: string | null
          id?: string
          percentage?: number
          total_marks?: number
          total_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assessment_id: string
          completed_at: string | null
          created_at: string | null
          fullscreen_violations: number | null
          id: string
          is_terminated: boolean | null
          started_at: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          completed_at?: string | null
          created_at?: string | null
          fullscreen_violations?: number | null
          id?: string
          is_terminated?: boolean | null
          started_at?: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          completed_at?: string | null
          created_at?: string | null
          fullscreen_violations?: number | null
          id?: string
          is_terminated?: boolean | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          created_at: string | null
          id: string
          input: string
          is_hidden: boolean
          marks: number
          order_index: number
          output: string
          question_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          input: string
          is_hidden?: boolean
          marks?: number
          order_index: number
          output: string
          question_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          input?: string
          is_hidden?: boolean
          marks?: number
          order_index?: number
          output?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_assessment_total_marks: {
        Args: { assessment_id: string }
        Returns: number
      }
      calculate_coding_question_marks: {
        Args: { question_id: string }
        Returns: number
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
