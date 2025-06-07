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
      articles: {
        Row: {
          content: string | null
          created_at: string
          id: string
          question_id: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          question_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          question_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_constraints: {
        Row: {
          assessment_id: string
          created_at: string
          difficulty: string
          id: string
          number_of_questions: number
          question_type: string
          topic: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          difficulty: string
          id?: string
          number_of_questions: number
          question_type: string
          topic: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          difficulty?: string
          id?: string
          number_of_questions?: number
          question_type?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_constraints_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          end_time: string | null
          id: string
          instructions: string | null
          is_ai_proctored: boolean
          is_dynamic: boolean | null
          is_practice: boolean
          name: string
          reattempt: boolean
          start_time: string
          status: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          end_time?: string | null
          id?: string
          instructions?: string | null
          is_ai_proctored?: boolean
          is_dynamic?: boolean | null
          is_practice?: boolean
          name: string
          reattempt?: boolean
          start_time: string
          status?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          end_time?: string | null
          id?: string
          instructions?: string | null
          is_ai_proctored?: boolean
          is_dynamic?: boolean | null
          is_practice?: boolean
          name?: string
          reattempt?: boolean
          start_time?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      auth: {
        Row: {
          assigned_learning_paths: string[] | null
          batch: string | null
          course: string | null
          created_at: string
          department: string | null
          division: string | null
          email: string
          grad_year: string | null
          id: string
          name: string | null
          organization: string | null
          password: string
          prn: string | null
          role: string
          updated_at: string | null
          username: string | null
          year: string | null
        }
        Insert: {
          assigned_learning_paths?: string[] | null
          batch?: string | null
          course?: string | null
          created_at?: string
          department?: string | null
          division?: string | null
          email: string
          grad_year?: string | null
          id?: string
          name?: string | null
          organization?: string | null
          password: string
          prn?: string | null
          role?: string
          updated_at?: string | null
          username?: string | null
          year?: string | null
        }
        Update: {
          assigned_learning_paths?: string[] | null
          batch?: string | null
          course?: string | null
          created_at?: string
          department?: string | null
          division?: string | null
          email?: string
          grad_year?: string | null
          id?: string
          name?: string | null
          organization?: string | null
          password?: string
          prn?: string | null
          role?: string
          updated_at?: string | null
          username?: string | null
          year?: string | null
        }
        Relationships: []
      }
      auto_login_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      badge_types: {
        Row: {
          background_color: string | null
          created_at: string | null
          description: string | null
          icon_name: string | null
          id: string
          name: string
          text_color: string | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id: string
          name: string
          text_color?: string | null
        }
        Update: {
          background_color?: string | null
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          name?: string
          text_color?: string | null
        }
        Relationships: []
      }
      coding_examples: {
        Row: {
          coding_question_id: string
          created_at: string
          explanation: string | null
          id: string
          input: string
          order_index: number
          output: string
        }
        Insert: {
          coding_question_id: string
          created_at?: string
          explanation?: string | null
          id?: string
          input: string
          order_index: number
          output: string
        }
        Update: {
          coding_question_id?: string
          created_at?: string
          explanation?: string | null
          id?: string
          input?: string
          order_index?: number
          output?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_examples_coding_question_id_fkey"
            columns: ["coding_question_id"]
            isOneToOne: false
            referencedRelation: "coding_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_examples_bank: {
        Row: {
          coding_question_bank_id: string
          created_at: string
          explanation: string | null
          id: string
          input: string
          order_index: number
          output: string
        }
        Insert: {
          coding_question_bank_id: string
          created_at?: string
          explanation?: string | null
          id?: string
          input: string
          order_index: number
          output: string
        }
        Update: {
          coding_question_bank_id?: string
          created_at?: string
          explanation?: string | null
          id?: string
          input?: string
          order_index?: number
          output?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_examples_bank_coding_question_bank_id_fkey"
            columns: ["coding_question_bank_id"]
            isOneToOne: false
            referencedRelation: "coding_question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_languages: {
        Row: {
          coding_lang: string
          coding_question_id: string
          constraints: string[] | null
          created_at: string
          id: string
          solution_template: string
        }
        Insert: {
          coding_lang: string
          coding_question_id: string
          constraints?: string[] | null
          created_at?: string
          id?: string
          solution_template: string
        }
        Update: {
          coding_lang?: string
          coding_question_id?: string
          constraints?: string[] | null
          created_at?: string
          id?: string
          solution_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_languages_coding_question_id_fkey"
            columns: ["coding_question_id"]
            isOneToOne: false
            referencedRelation: "coding_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_languages_bank: {
        Row: {
          coding_lang: string
          coding_question_bank_id: string
          constraints: string | null
          created_at: string
          id: string
          solution_template: string
        }
        Insert: {
          coding_lang: string
          coding_question_bank_id: string
          constraints?: string | null
          created_at?: string
          id?: string
          solution_template: string
        }
        Update: {
          coding_lang?: string
          coding_question_bank_id?: string
          constraints?: string | null
          created_at?: string
          id?: string
          solution_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_languages_bank_coding_question_bank_id_fkey"
            columns: ["coding_question_bank_id"]
            isOneToOne: false
            referencedRelation: "coding_question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_question_bank: {
        Row: {
          created_at: string
          created_by: string
          description: string
          difficulty: string | null
          id: string
          image_url: string | null
          serial: number | null
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          difficulty?: string | null
          id?: string
          image_url?: string | null
          serial?: number | null
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          difficulty?: string | null
          id?: string
          image_url?: string | null
          serial?: number | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_question_bank_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_questions: {
        Row: {
          assessment_id: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          marks: number
          order_index: number
          title: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          marks?: number
          order_index: number
          title: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          marks?: number
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          message: string | null
          name: string
          status: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name: string
          status?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name?: string
          status?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      learning_paths: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty: string | null
          id: string
          sr: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id: string
          sr?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          sr?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mcq_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          mcq_question_id: string
          order_index: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          mcq_question_id: string
          order_index: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          mcq_question_id?: string
          order_index?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcq_options_mcq_question_id_fkey"
            columns: ["mcq_question_id"]
            isOneToOne: false
            referencedRelation: "mcq_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      mcq_options_bank: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          mcq_question_bank_id: string
          order_index: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          mcq_question_bank_id: string
          order_index: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          mcq_question_bank_id?: string
          order_index?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcq_options_bank_mcq_question_bank_id_fkey"
            columns: ["mcq_question_bank_id"]
            isOneToOne: false
            referencedRelation: "mcq_question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      mcq_question_bank: {
        Row: {
          created_at: string
          created_by: string
          description: string
          difficulty: string | null
          id: string
          image_url: string | null
          marks: number
          serial: number | null
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          difficulty?: string | null
          id?: string
          image_url?: string | null
          marks?: number
          serial?: number | null
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          difficulty?: string | null
          id?: string
          image_url?: string | null
          marks?: number
          serial?: number | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcq_question_bank_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      mcq_questions: {
        Row: {
          assessment_id: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          marks: number
          order_index: number
          title: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          marks?: number
          order_index: number
          title: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          marks?: number
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcq_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      proctoring_sessions: {
        Row: {
          assessment_id: string
          created_at: string | null
          ended_at: string | null
          flagged_actions: Json | null
          id: string
          recording_path: string
          recording_status: string | null
          recording_url: string | null
          started_at: string | null
          submission_id: string | null
          user_id: string
          violation_timestamps: Json | null
        }
        Insert: {
          assessment_id: string
          created_at?: string | null
          ended_at?: string | null
          flagged_actions?: Json | null
          id?: string
          recording_path: string
          recording_status?: string | null
          recording_url?: string | null
          started_at?: string | null
          submission_id?: string | null
          user_id: string
          violation_timestamps?: Json | null
        }
        Update: {
          assessment_id?: string
          created_at?: string | null
          ended_at?: string | null
          flagged_actions?: Json | null
          id?: string
          recording_path?: string
          recording_status?: string | null
          recording_url?: string | null
          started_at?: string | null
          submission_id?: string | null
          user_id?: string
          violation_timestamps?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_sessions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_sessions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          cgpa: number | null
          college_name: string | null
          created_at: string | null
          gfg_url: string | null
          github_url: string | null
          hackerrank_url: string | null
          id: string
          leetcode_url: string | null
          linkedin_url: string | null
          location: string | null
          profile_picture_url: string | null
          real_name: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          cgpa?: number | null
          college_name?: string | null
          created_at?: string | null
          gfg_url?: string | null
          github_url?: string | null
          hackerrank_url?: string | null
          id: string
          leetcode_url?: string | null
          linkedin_url?: string | null
          location?: string | null
          profile_picture_url?: string | null
          real_name?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          cgpa?: number | null
          college_name?: string | null
          created_at?: string | null
          gfg_url?: string | null
          github_url?: string | null
          hackerrank_url?: string | null
          id?: string
          leetcode_url?: string | null
          linkedin_url?: string | null
          location?: string | null
          profile_picture_url?: string | null
          real_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      question_submissions: {
        Row: {
          code_solution: string | null
          created_at: string
          id: string
          is_correct: boolean | null
          language: string | null
          marks_obtained: number
          mcq_option_id: string | null
          question_id: string
          question_type: string
          submission_id: string
          test_results: Json | null
        }
        Insert: {
          code_solution?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          language?: string | null
          marks_obtained?: number
          mcq_option_id?: string | null
          question_id: string
          question_type: string
          submission_id: string
          test_results?: Json | null
        }
        Update: {
          code_solution?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          language?: string | null
          marks_obtained?: number
          mcq_option_id?: string | null
          question_id?: string
          question_type?: string
          submission_id?: string
          test_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "question_submissions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          created_at: string | null
          difficulty: string | null
          id: string
          practice_link: string | null
          questionid: string | null
          solution_link: string | null
          title: string | null
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          difficulty?: string | null
          id: string
          practice_link?: string | null
          questionid?: string | null
          solution_link?: string | null
          title?: string | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          difficulty?: string | null
          id?: string
          practice_link?: string | null
          questionid?: string | null
          solution_link?: string | null
          title?: string | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          assessment_id: string
          completed_at: string
          created_at: string
          id: string
          is_cheated: boolean | null
          percentage: number
          submission_id: string
          total_marks: number
          total_score: number
          user_id: string
        }
        Insert: {
          assessment_id: string
          completed_at: string
          created_at?: string
          id?: string
          is_cheated?: boolean | null
          percentage?: number
          submission_id: string
          total_marks?: number
          total_score?: number
          user_id: string
        }
        Update: {
          assessment_id?: string
          completed_at?: string
          created_at?: string
          id?: string
          is_cheated?: boolean | null
          percentage?: number
          submission_id?: string
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
          {
            foreignKeyName: "results_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assessment_id: string
          completed_at: string | null
          created_at: string
          face_violations: Json | null
          fullscreen_violations: number | null
          id: string
          is_terminated: boolean | null
          object_violations: Json | null
          started_at: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          completed_at?: string | null
          created_at?: string
          face_violations?: Json | null
          fullscreen_violations?: number | null
          id?: string
          is_terminated?: boolean | null
          object_violations?: Json | null
          started_at?: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          completed_at?: string | null
          created_at?: string
          face_violations?: Json | null
          fullscreen_violations?: number | null
          id?: string
          is_terminated?: boolean | null
          object_violations?: Json | null
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
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          coding_question_id: string
          created_at: string
          id: string
          input: string
          is_hidden: boolean
          marks: number
          order_index: number
          output: string
        }
        Insert: {
          coding_question_id: string
          created_at?: string
          id?: string
          input: string
          is_hidden?: boolean
          marks?: number
          order_index: number
          output: string
        }
        Update: {
          coding_question_id?: string
          created_at?: string
          id?: string
          input?: string
          is_hidden?: boolean
          marks?: number
          order_index?: number
          output?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_coding_question_id_fkey"
            columns: ["coding_question_id"]
            isOneToOne: false
            referencedRelation: "coding_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases_bank: {
        Row: {
          coding_question_bank_id: string
          created_at: string
          id: string
          input: string
          is_hidden: boolean
          marks: number
          order_index: number
          output: string
        }
        Insert: {
          coding_question_bank_id: string
          created_at?: string
          id?: string
          input: string
          is_hidden?: boolean
          marks?: number
          order_index: number
          output: string
        }
        Update: {
          coding_question_bank_id?: string
          created_at?: string
          id?: string
          input?: string
          is_hidden?: boolean
          marks?: number
          order_index?: number
          output?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_bank_coding_question_bank_id_fkey"
            columns: ["coding_question_bank_id"]
            isOneToOne: false
            referencedRelation: "coding_question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string | null
          id: string
          learning_path_id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          learning_path_id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          learning_path_id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      user_code_snippets: {
        Row: {
          assessment_id: string
          code: string
          created_at: string | null
          id: string
          language: string
          question_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assessment_id: string
          code: string
          created_at?: string | null
          id?: string
          language: string
          question_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assessment_id?: string
          code?: string
          created_at?: string | null
          id?: string
          language?: string
          question_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_code_snippets_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          created_at: string | null
          id: string
          is_completed: boolean
          is_marked_for_revision: boolean
          question_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id: string
          is_completed?: boolean
          is_marked_for_revision?: boolean
          question_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_completed?: boolean
          is_marked_for_revision?: boolean
          question_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skills: {
        Row: {
          created_at: string | null
          id: string
          skill_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id: string
          skill_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          skill_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          assigned_learning_paths: string[] | null
          course: string | null
          created_at: string | null
          department: string | null
          email: string | null
          grad_year: string | null
          id: string
          password: string | null
          prn: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          assigned_learning_paths?: string[] | null
          course?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          grad_year?: string | null
          id: string
          password?: string | null
          prn?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          assigned_learning_paths?: string[] | null
          course?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          grad_year?: string | null
          id?: string
          password?: string | null
          prn?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      assessment_results_view: {
        Row: {
          assessment_code: string | null
          assessment_title: string | null
          department: string | null
          percentage: number | null
          prn: string | null
          termination_status: string | null
          total_marks: number | null
          total_score: number | null
          user_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      authenticate_user: {
        Args: { prn_input: string; password_input: string }
        Returns: {
          id: string
          username: string
          prn: string
          email: string
          department: string
          course: string
          grad_year: number
        }[]
      }
      calculate_assessment_total_marks: {
        Args: { assessment_id: string }
        Returns: number
      }
      calculate_coding_question_marks: {
        Args: { question_id: string }
        Returns: number
      }
      calculate_mcq_question_marks: {
        Args: { question_id: string }
        Returns: number
      }
      exec_sql: {
        Args: { sql_query: string }
        Returns: undefined
      }
      insert_coding_assessment_question: {
        Args: {
          p_assessment_code: string
          p_title: string
          p_description: string
          p_order_index: number
          p_examples: Json[]
          p_test_cases: Json[]
        }
        Returns: undefined
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
