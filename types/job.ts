export type ContractType = 'cdi' | 'cdd' | 'freelance' | 'stage' | 'alternance';
export type RemotePolicy = 'full' | 'partial' | 'none';
export type SalaryPeriod = 'yearly' | 'monthly' | 'daily' | 'hourly';

export interface JobOffer {
  id: string;
  title: string;
  company_name: string;
  company_logo_url: string | null;
  location: string | null;
  contract_type: ContractType;
  remote_policy: RemotePolicy;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: SalaryPeriod | null;
  currency: string;
  description: string | null;
  tags: string[];
  source_name: string;
  source_url: string;
  source_id?: string | null;
  fingerprint: string;
  is_active: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface JobFilters {
  searchQuery: string;
  contractType: 'all' | 'freelance' | 'cdi';
  selectedTag: string | null;
  selectedSource: string | null;
  remoteOnly: boolean;
}
