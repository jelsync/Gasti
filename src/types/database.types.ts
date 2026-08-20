// Tipos de la base de datos de Supabase.
// Reflejan el esquema definido en supabase/migrations/.
// Si cambias el esquema, actualiza estos tipos (o regenéralos con la CLI de Supabase).

export type TransactionType = 'INCOME' | 'EXPENSE' | 'SAVING';
export type Currency = 'HNL' | 'USD';

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
          credit_card_id: string | null;
          savings_account_id: string | null;
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
          credit_card_id?: string | null;
          savings_account_id?: string | null;
          type: TransactionType;
          amount: number;
          description?: string;
          transaction_date?: string;
        };
        Update: {
          category_id?: string | null;
          credit_card_id?: string | null;
          savings_account_id?: string | null;
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
          {
            foreignKeyName: 'transactions_credit_card_id_fkey';
            columns: ['credit_card_id'];
            isOneToOne: false;
            referencedRelation: 'credit_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_savings_account_id_fkey';
            columns: ['savings_account_id'];
            isOneToOne: false;
            referencedRelation: 'savings_accounts';
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
      credit_cards: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          bank: string;
          currency: Currency;
          opening_balance: number;
          credit_limit: number | null;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          bank?: string;
          currency?: Currency;
          opening_balance?: number;
          credit_limit?: number | null;
          color?: string;
        };
        Update: {
          name?: string;
          bank?: string;
          currency?: Currency;
          opening_balance?: number;
          credit_limit?: number | null;
          color?: string;
        };
        Relationships: [];
      };
      card_payments: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          amount: number;
          amount_hnl: number | null;
          payment_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          amount: number;
          amount_hnl?: number | null;
          payment_date?: string;
        };
        Update: {
          amount?: number;
          amount_hnl?: number | null;
          payment_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'card_payments_card_id_fkey';
            columns: ['card_id'];
            isOneToOne: false;
            referencedRelation: 'credit_cards';
            referencedColumns: ['id'];
          },
        ];
      };
      savings_accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          institution: string;
          opening_balance: number;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          institution?: string;
          opening_balance?: number;
          color?: string;
        };
        Update: {
          name?: string;
          institution?: string;
          opening_balance?: number;
          color?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      transaction_type: TransactionType;
    };
  };
}
