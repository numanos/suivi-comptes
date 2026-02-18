export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface Theme {
  id: number;
  name: string;
  is_default: boolean;
  display_order: number;
  categories?: Category[];
}

export interface Category {
  id: number;
  name: string;
  theme_id: number;
  theme_name?: string;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: number;
  name: string;
  category_id: number;
}

export interface Transaction {
  id: number;
  date: string;
  libelle: string;
  note: string | null;
  amount: number;
  category_id: number | null;
  category_name: string | null;
  subcategory_id: number | null;
  subcategory_name: string | null;
  balance: number | null;
  is_pointed: boolean;
  tags: string | null;
  import_batch_id: number | null;
  created_at: string;
}

export interface MonthlySummary {
  month: number;
  year: number;
  total_expenses: number;
  total_income: number;
  total_savings: number;
  net: number;
}

export interface AnnualSummary {
  year: number;
  months: MonthlySummary[];
  totals: {
    expenses: number;
    income: number;
    savings: number;
  };
}

export interface Envelope {
  id: number;
  name: string;
  type: 'Action' | 'Immo' | 'Obligations' | 'Liquidités';
  placements?: Placement[];
}

export interface Placement {
  id: number;
  envelope_id: number;
  name: string;
  type_placement: string;
  year: number;
  versements: number;
  valorization: number;
}

export interface PatrimonyEvolution {
  year: number;
  actions: number;
  immo: number;
  obligations: number;
  liquidites: number;
  total: number;
  evolution: number | null;
  evolution_percent: number | null;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
}
