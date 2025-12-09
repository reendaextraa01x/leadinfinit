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
  painPoints?: string[]; // Specific problems detected (e.g., "No Website", "Bad Reviews")
  matchReason?: string;  // Why this lead is a perfect fit for the user's service
  qualityTier?: 'opportunity' | 'high-ticket' | 'urgent'; // Quality filter tag
}

export type BusinessSize = 'small' | 'medium' | 'large';
export type LeadQualityFilter = 'opportunity' | 'high-ticket' | 'urgent';

export interface SearchFilters {
  websiteRule: 'any' | 'must_have' | 'must_not_have';
  mustHaveInstagram: boolean;
  mobileOnly: boolean;
}

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

export type ObjectionType = 'expensive' | 'partner' | 'send_info' | 'has_agency' | 'later';

// SALES LAB TYPES
export interface SequenceDay {
  day: string;
  trigger: string;
  subject?: string;
  message: string;
  explanation: string;
}

export type RoleplayProfile = 'skeptic' | 'cheap' | 'hasty';

export interface RoleplayMessage {
  sender: 'user' | 'ai';
  text: string;
  feedback?: string; // AI Coach feedback on user's move
  score?: number;    // 0-10 score of the user's response
  betterResponse?: string; // An alternative "Perfect" response suggested by AI
}

// CHAT ANALYSIS (AUTOPSY)
export interface ChatAnalysis {
  score: number; // 0-100 Probability of closing
  sentiment: 'positive' | 'neutral' | 'negative';
  hiddenIntent: string; // The subtext of the client
  nextMove: string; // The exact text to send next
  tip: string; // Strategic advice
}