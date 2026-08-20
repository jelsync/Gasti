// Tipos de la base de datos de Supabase.
// Reflejan el esquema definido en supabase/migrations/.
// Si cambias el esquema, actualiza estos tipos (o regenéralos con la CLI de Supabase).

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: TransactionType;
          icon: string;
          color: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: TransactionType;
          icon?: string;
          color?: string;
          is_default?: boolean;
        };
        Update: {
          name?: string;
          type?: TransactionType;
          icon?: string;
          color?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          type: TransactionType;
          amount: number;
          description: string;
          transaction_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          type: TransactionType;
          amount: number;
          description?: string;
          transaction_date?: string;
        };
        Update: {
          category_id?: string | null;
          type?: TransactionType;
          amount?: number;
          description?: string;
          transaction_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          amount: number;
          month: number;
          year: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          month: number;
          year: number;
        };
        Update: {
          category_id?: string;
          amount?: number;
          month?: number;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'budgets_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      loans: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          name: string;
          loan_number: string;
          original_amount: number;
          interest_rate: number;
          term_months: number;
          installment: number;
          current_balance: number;
          extra_payment: number | null;
          start_date: string;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          name: string;
          loan_number?: string;
          original_amount: number;
          interest_rate?: number;
          term_months: number;
          installment: number;
          current_balance: number;
          extra_payment?: number | null;
          start_date?: string;
          end_date?: string | null;
        };
        Update: {
          category_id?: string | null;
          name?: string;
          loan_number?: string;
          original_amount?: number;
          interest_rate?: number;
          term_months?: number;
          installment?: number;
          current_balance?: number;
          extra_payment?: number | null;
          start_date?: string;
          end_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'loans_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      transaction_type: TransactionType;
    };
  };
}
