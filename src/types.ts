export type PlatformType = 'Checkatrade' | 'MyBuilder' | 'TrustATrader' | 'Bark' | 'Direct';

export type ToneType =
  | 'professional_polished'
  | 'friendly_approachable'
  | 'urgent_fasttrack'
  | 'direct_pricing'
  | 'consultative_expert';

export type CallToActionType = 'site_visit' | 'call_me' | 'send_photos' | 'instant_booking';

export type ReplyLengthType = 'concise' | 'standard' | 'detailed';

export interface Lead {
  id: string;
  customerName: string;
  platform: PlatformType;
  phone: string;
  email: string;
  location: string;
  postcode: string;
  tradeCategory: string;
  jobTitle: string;
  messageText: string;
  receivedAt: string;
  urgency: 'Emergency (Immediate)' | 'Urgent (24-48h)' | 'Flexible / Planning';
  status: 'new' | 'analyzed' | 'drafted' | 'replied';
  photos?: string[];
  budgetStated?: string;
  responseHistory?: {
    sender: 'customer' | 'tradesperson';
    text: string;
    timestamp: string;
  }[];
}

export interface LeadAnalysis {
  customerName: string;
  tradeCategory: string;
  urgency: string;
  urgencyReasoning: string;
  scopeSummary: string;
  jobLocation: string;
  budgetHint: string;
  leadQualityScore: number;
  keyQuestionsNeeded: string[];
  recommendedReplyAngle: string;
  sentiment: string;
  suggestedTemplateKey: string;
}

export interface BusinessProfile {
  companyName: string;
  tradeType: string;
  contactPerson: string;
  phone: string;
  email: string;
  website: string;
  yearsInBusiness: number;
  checkatradeRating: number;
  reviewsCount: number;
  calloutFee: string;
  hourlyRate: string;
  travelRadius: string;
  guaranteeDetails: string;
  availableTimeslots: string;
  accreditationBadge: string;
}

export interface ToneSettings {
  activeTone: ToneType;
  formalityLevel: number; // 1 (Very casual) to 5 (Very formal)
  replyLength: ReplyLengthType;
  includeCheckatradeBadge: boolean;
  includeCallToAction: CallToActionType;
  customRulePrompt: string;
  autoSignOff: boolean;
}

export interface Template {
  id: string;
  title: string;
  category: string;
  description: string;
  body: string;
  variablesUsed: string[];
  isCustom?: boolean;
}
