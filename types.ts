
declare var process: any;

export type LeadStatus = 'new' | 'contacted' | 'negotiation' | 'closed';
export type LeadScore = 'hot' | 'warm' | 'cold';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  instagram: string | null;
  description: string;
  website?: string;
  confidenceScore: number;
  status: LeadStatus; // Kanban Status
  score: LeadScore;   // AI Rating
  audit?: string;     // AI Generated Technical Audit
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

export interface ServiceInsights {
  recommendedNiche: string;
  suggestedTicket: number;
  reasoning: string;
  potential: string;
}

export interface ServiceContext {
  serviceName: string;
  description: string;
  targetAudience: string;
  ticketValue?: number;
  insights?: ServiceInsights; // AI Strategic Advice
}

export interface SearchHistoryItem {
  niche: string;
  location: string;
  size: BusinessSize;
  timestamp: number;
}
