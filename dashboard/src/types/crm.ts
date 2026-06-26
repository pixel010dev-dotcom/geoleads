export interface CrmLead {
  nome: string;
  telefone: string;
  email: string;
  site: string;
  endereco: string;
  avaliacao: string;
  reviewCount: string;
  categoria: string;
  horarios: string;
  cep: string;
  placeUrl: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  cnpj: string;
  stage: string;
  notes: string;
  tags: string[];
  savedAt: string;
  nicho: string;
  cidade: string;
}

export interface CrmLeadRow {
  user_id: string;
  lead_key: string;
  nome: string;
  telefone: string;
  email: string;
  site: string;
  avaliacao: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  cnpj: string;
  stage: string;
  notes: string;
  nicho: string;
  cidade: string;
  saved_at: string;
  payload: Partial<CrmLead>;
}

export interface ChatbotRule {
  id: string;
  keyword: string;
  responseKey: string;
  enabled: boolean;
}

export interface BatchEnrichProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  status: string;
}

export interface ExtractStats {
  total: number;
  scanned: number;
  cities_scanned: number;
  time: number;
  correctedKeyword: string;
  correctedLocation: string;
  message: string;
  broadRegion?: boolean;
}

export interface WaSentMessage {
  id: string;
  lead_name: string;
  lead_telefone: string;
  message: string;
  sent_at: string;
  status: string;
  error_message?: string;
}

export interface BatchResult {
  nome: string;
  enriched: Record<string, any> | null;
  error?: string;
  leadKey?: string;
}

export interface AiCopyResult {
  title: string;
  desc: string;
  text: string;
}

export interface BatchPollResponse {
  success: boolean;
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  status: 'running' | 'completed' | 'failed';
  results: BatchResult[];
  error?: string;
  createdAt: number;
}
