// Tipos de la base de datos de Supabase.
// Reflejan el esquema definido en supabase/migrations/.
// Si cambias el esquema, actualiza estos tipos (o regenéralos con la CLI de Supabase).

export type TransactionType = 'INCOME' | 'EXPENSE' | 'SAVING' | 'TRANSFER';
export type Currency = 'HNL' | 'USD';
export type BudgetKind = 'CATEGORY' | 'SAVINGS';
export type ReceivableRelationship = 'FAMILY' | 'FRIEND' | 'OTHER';
export type RecurringOccurrenceStatus = 'COMPLETED' | 'SKIPPED';
export type FinancialGoalType = 'EMERGENCY' | 'TRAVEL' | 'VEHICLE' | 'HOME' | 'EDUCATION' | 'OTHER';
export type FinancialGoalStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type FinancialGoalMovementKind = 'CONTRIBUTION' | 'WITHDRAWAL';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
          destination_savings_account_id: string | null;
          receivable_person_id: string | null;
          receivable_movement_kind: 'LEND' | 'REPAYMENT' | null;
          loan_id: string | null;
          loan_payment_kind: 'INSTALLMENT' | 'EXTRA' | null;
          loan_principal_amount: number | null;
          loan_interest_amount: number | null;
          loan_balance_after: number | null;
          type: TransactionType;
          amount: number;
          currency: Currency;
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
          destination_savings_account_id?: string | null;
          receivable_person_id?: string | null;
          receivable_movement_kind?: 'LEND' | 'REPAYMENT' | null;
          loan_id?: string | null;
          loan_payment_kind?: 'INSTALLMENT' | 'EXTRA' | null;
          loan_principal_amount?: number | null;
          loan_interest_amount?: number | null;
          loan_balance_after?: number | null;
          type: TransactionType;
          amount: number;
          currency?: Currency;
          description?: string;
          transaction_date?: string;
        };
        Update: {
          category_id?: string | null;
          credit_card_id?: string | null;
          savings_account_id?: string | null;
          destination_savings_account_id?: string | null;
          receivable_person_id?: string | null;
          receivable_movement_kind?: 'LEND' | 'REPAYMENT' | null;
          loan_id?: string | null;
          loan_payment_kind?: 'INSTALLMENT' | 'EXTRA' | null;
          loan_principal_amount?: number | null;
          loan_interest_amount?: number | null;
          loan_balance_after?: number | null;
          type?: TransactionType;
          amount?: number;
          currency?: Currency;
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
          {
            foreignKeyName: 'transactions_destination_savings_account_id_fkey';
            columns: ['destination_savings_account_id'];
            isOneToOne: false;
            referencedRelation: 'savings_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_loan_id_fkey';
            columns: ['loan_id'];
            isOneToOne: false;
            referencedRelation: 'loans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_receivable_person_id_fkey';
            columns: ['receivable_person_id'];
            isOneToOne: false;
            referencedRelation: 'receivable_people';
            referencedColumns: ['id'];
          },
        ];
      };
      receivable_people: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          relationship: ReceivableRelationship;
          phone: string;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          relationship?: ReceivableRelationship;
          phone?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          relationship?: ReceivableRelationship;
          phone?: string;
          notes?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          kind: BudgetKind;
          amount: number;
          currency: Currency;
          month: number;
          year: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          kind?: BudgetKind;
          amount: number;
          currency?: Currency;
          month: number;
          year: number;
        };
        Update: {
          category_id?: string | null;
          kind?: BudgetKind;
          amount?: number;
          currency?: Currency;
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
          payment_day: number | null;
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
          payment_day?: number | null;
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
          payment_day?: number | null;
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
          opening_balance_usd: number;
          credit_limit: number | null;
          credit_limit_usd: number | null;
          payment_due_day: number | null;
          statement_day: number | null;
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
          opening_balance_usd?: number;
          credit_limit?: number | null;
          credit_limit_usd?: number | null;
          payment_due_day?: number | null;
          statement_day?: number | null;
          color?: string;
        };
        Update: {
          name?: string;
          bank?: string;
          opening_balance?: number;
          opening_balance_usd?: number;
          credit_limit?: number | null;
          credit_limit_usd?: number | null;
          payment_due_day?: number | null;
          statement_day?: number | null;
          color?: string;
        };
        Relationships: [];
      };
      card_statements: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          statement_date: string;
          period_start: string;
          statement_day: number;
          opening_hnl: number;
          opening_usd: number;
          charges_hnl: number;
          charges_usd: number;
          payments_hnl: number;
          payments_usd: number;
          balance_hnl: number;
          balance_usd: number;
          confirmed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          statement_date: string;
          period_start: string;
          statement_day: number;
          opening_hnl: number;
          opening_usd: number;
          charges_hnl: number;
          charges_usd: number;
          payments_hnl: number;
          payments_usd: number;
          balance_hnl: number;
          balance_usd: number;
          confirmed_at?: string;
        };
        Update: {
          period_start?: string;
          statement_day?: number;
          opening_hnl?: number;
          opening_usd?: number;
          charges_hnl?: number;
          charges_usd?: number;
          payments_hnl?: number;
          payments_usd?: number;
          balance_hnl?: number;
          balance_usd?: number;
          confirmed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'card_statements_card_id_fkey';
            columns: ['card_id'];
            isOneToOne: false;
            referencedRelation: 'credit_cards';
            referencedColumns: ['id'];
          },
        ];
      };
      card_payments: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          amount: number;
          amount_hnl: number | null;
          currency: Currency;
          payment_date: string;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          amount: number;
          amount_hnl?: number | null;
          currency?: Currency;
          payment_date?: string;
          transaction_id?: string | null;
        };
        Update: {
          amount?: number;
          amount_hnl?: number | null;
          currency?: Currency;
          payment_date?: string;
          transaction_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'card_payments_card_id_fkey';
            columns: ['card_id'];
            isOneToOne: false;
            referencedRelation: 'credit_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'card_payments_transaction_id_fkey';
            columns: ['transaction_id'];
            isOneToOne: true;
            referencedRelation: 'transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      card_charges: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          amount: number;
          amount_hnl: number | null;
          currency: Currency;
          description: string;
          charge_date: string;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          amount: number;
          amount_hnl?: number | null;
          currency?: Currency;
          description?: string;
          charge_date?: string;
          transaction_id?: string | null;
        };
        Update: {
          amount?: number;
          amount_hnl?: number | null;
          currency?: Currency;
          description?: string;
          charge_date?: string;
          transaction_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'card_charges_card_id_fkey';
            columns: ['card_id'];
            isOneToOne: false;
            referencedRelation: 'credit_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'card_charges_transaction_id_fkey';
            columns: ['transaction_id'];
            isOneToOne: true;
            referencedRelation: 'transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      recurring_transactions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: TransactionType;
          amount: number;
          currency: Currency;
          category_id: string | null;
          savings_account_id: string | null;
          credit_card_id: string | null;
          description: string;
          day_of_month: number;
          start_date: string;
          end_date: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: TransactionType;
          amount: number;
          currency?: Currency;
          category_id?: string | null;
          savings_account_id?: string | null;
          credit_card_id?: string | null;
          description?: string;
          day_of_month: number;
          start_date?: string;
          end_date?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          type?: TransactionType;
          amount?: number;
          currency?: Currency;
          category_id?: string | null;
          savings_account_id?: string | null;
          credit_card_id?: string | null;
          description?: string;
          day_of_month?: number;
          start_date?: string;
          end_date?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      recurring_occurrences: {
        Row: {
          id: string;
          user_id: string;
          recurring_transaction_id: string;
          due_date: string;
          period_start: string;
          status: RecurringOccurrenceStatus;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recurring_transaction_id: string;
          due_date: string;
          status: RecurringOccurrenceStatus;
          transaction_id?: string | null;
        };
        Update: {
          status?: RecurringOccurrenceStatus;
          transaction_id?: string | null;
        };
        Relationships: [];
      };
      account_reconciliations: {
        Row: {
          id: string;
          user_id: string;
          savings_account_id: string;
          reconciliation_date: string;
          calculated_balance: number;
          actual_balance: number;
          difference: number;
          apply_adjustment: boolean;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          savings_account_id: string;
          reconciliation_date?: string;
          calculated_balance: number;
          actual_balance: number;
          apply_adjustment?: boolean;
          notes?: string;
          created_at?: string;
        };
        Update: {
          savings_account_id?: string;
          reconciliation_date?: string;
          calculated_balance?: number;
          actual_balance?: number;
          apply_adjustment?: boolean;
          notes?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_reconciliations_savings_account_id_fkey';
            columns: ['savings_account_id'];
            isOneToOne: false;
            referencedRelation: 'savings_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      month_closures: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          month: number;
          snapshot: Json;
          notes: string;
          closed_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          month: number;
          snapshot: Json;
          notes?: string;
          closed_at?: string;
          updated_at?: string;
        };
        Update: {
          snapshot?: Json;
          notes?: string;
          closed_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      financial_goals: {
        Row: {
          id: string;
          user_id: string;
          savings_account_id: string | null;
          name: string;
          goal_type: FinancialGoalType;
          target_amount: number;
          starting_amount: number;
          target_date: string | null;
          color: string;
          status: FinancialGoalStatus;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          savings_account_id?: string | null;
          name: string;
          goal_type?: FinancialGoalType;
          target_amount: number;
          starting_amount?: number;
          target_date?: string | null;
          color?: string;
          status?: FinancialGoalStatus;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          savings_account_id?: string | null;
          name?: string;
          goal_type?: FinancialGoalType;
          target_amount?: number;
          starting_amount?: number;
          target_date?: string | null;
          color?: string;
          status?: FinancialGoalStatus;
          notes?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_goals_savings_account_id_fkey';
            columns: ['savings_account_id'];
            isOneToOne: false;
            referencedRelation: 'savings_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_goal_movements: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string;
          movement_kind: FinancialGoalMovementKind;
          amount: number;
          movement_date: string;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id: string;
          movement_kind: FinancialGoalMovementKind;
          amount: number;
          movement_date?: string;
          notes?: string;
          created_at?: string;
        };
        Update: {
          movement_kind?: FinancialGoalMovementKind;
          amount?: number;
          movement_date?: string;
          notes?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_goal_movements_goal_id_fkey';
            columns: ['goal_id'];
            isOneToOne: false;
            referencedRelation: 'financial_goals';
            referencedColumns: ['id'];
          },
        ];
      };
      savings_accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          account_number: string;
          opening_balance: number;
          include_in_savings_goal: boolean;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          account_number?: string;
          opening_balance?: number;
          include_in_savings_goal?: boolean;
          color?: string;
        };
        Update: {
          name?: string;
          account_number?: string;
          opening_balance?: number;
          include_in_savings_goal?: boolean;
          color?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      export_user_backup: {
        Args: Record<string, never>;
        Returns: Json;
      };
      import_bank_transactions: {
        Args: { p_account_id: string; p_rows: Json };
        Returns: Json;
      };
      confirm_recurring_transaction: {
        Args: {
          p_recurring_id: string;
          p_due_date: string;
          p_transaction_date?: string;
          p_existing_transaction_id?: string;
          p_amount?: number;
          p_allow_duplicate?: boolean;
          p_description?: string;
        };
        Returns: string;
      };
      get_recurring_candidates: {
        Args: { p_recurring_id: string; p_due_date: string };
        Returns: Database['public']['Tables']['transactions']['Row'][];
      };
      preview_card_statement: {
        Args: { p_card_id: string; p_statement_date: string };
        Returns: Json;
      };
      confirm_card_statement: {
        Args: { p_card_id: string; p_statement_date: string; p_expected_snapshot: Json };
        Returns: Database['public']['Tables']['card_statements']['Row'];
      };
      skip_recurring_occurrence: {
        Args: { p_recurring_id: string; p_due_date: string };
        Returns: undefined;
      };
      create_financial_goal_movement: {
        Args: {
          p_goal_id: string;
          p_movement_kind: FinancialGoalMovementKind;
          p_amount: number;
          p_movement_date: string;
          p_notes?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      transaction_type: TransactionType;
    };
  };
}
