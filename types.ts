
declare var process: any;

export interface Lead {
  id: string;
  name: string;
  phone: string;
  instagram: string | null;
  description: string;
  website?: string;
  confidenceScore: number;
}

export type BusinessSize = 'small' | 'medium' | 'large';

export interface SearchState {
  isSearching: boolean;
  error: string | null;
  hasSearched: boolean;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ServiceContext {
  serviceName: string;
  description: string;
  targetAudience: string;
}