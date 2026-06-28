import { createAdminSupabaseClient } from '@/lib/server-auth';

export type MemoryEntry = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export type ExtractedData = {
  nome?: string;
  empresa?: string;
  cidade?: string;
  nicho?: string;
  interesse?: string;
  etapa?: string;
  score?: number;
  telefone?: string;
  ultima_interacao?: string;
  [key: string]: unknown;
};

export type ContactMemory = {
  id: string;
  userId: string;
  contactJid: string;
  contactName: string | null;
  extractedData: ExtractedData;
  conversationHistory: MemoryEntry[];
  createdAt: string;
  updatedAt: string;
};

const MAX_HISTORY_TURNS = 20;

export class ChatbotMemory {
  private static adminClient = createAdminSupabaseClient();

  static async getOrCreate(userId: string, contactJid: string, contactName?: string): Promise<ContactMemory | null> {
    const { data, error } = await this.adminClient
      .from('chatbot_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_jid', contactJid)
      .single();

    if (data) {
      return this.rowToMemory(data);
    }

    if (error && error.code !== 'PGRST116') {
      console.error('[ChatbotMemory] Erro ao buscar memória:', error);
    }

    const { data: inserted, error: insertError } = await this.adminClient
      .from('chatbot_memory')
      .insert({
        user_id: userId,
        contact_jid: contactJid,
        contact_name: contactName || null,
        extracted_data: {},
        conversation_history: [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('[ChatbotMemory] Erro ao criar memória:', insertError);
      return null;
    }

    return this.rowToMemory(inserted);
  }

  static async addTurn(
    userId: string,
    contactJid: string,
    entry: MemoryEntry
  ): Promise<void> {
    const memory = await this.getOrCreate(userId, contactJid);
    if (!memory) return;

    const history = [...memory.conversationHistory, entry];
    const trimmed = history.slice(-MAX_HISTORY_TURNS);

    const { error } = await this.adminClient
      .from('chatbot_memory')
      .update({
        conversation_history: trimmed,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('contact_jid', contactJid);

    if (error) {
      console.error('[ChatbotMemory] Erro ao adicionar turno:', error);
    }
  }

  static async updateExtractedData(
    userId: string,
    contactJid: string,
    data: Partial<ExtractedData>
  ): Promise<void> {
    const memory = await this.getOrCreate(userId, contactJid);
    if (!memory) return;

    const merged = {
      ...memory.extractedData,
      ...data,
      ultima_interacao: new Date().toISOString(),
    };

    const { error } = await this.adminClient
      .from('chatbot_memory')
      .update({
        extracted_data: merged,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('contact_jid', contactJid);

    if (error) {
      console.error('[ChatbotMemory] Erro ao atualizar dados:', error);
    }
  }

  static getRecentHistory(memory: ContactMemory, count: number = 10): MemoryEntry[] {
    return memory.conversationHistory.slice(-count);
  }

  static getContextSummary(memory: ContactMemory): string {
    const data = memory.extractedData;
    const parts: string[] = [];

    if (data.nome) parts.push(`Nome: ${data.nome}`);
    if (data.empresa) parts.push(`Empresa: ${data.empresa}`);
    if (data.cidade) parts.push(`Cidade: ${data.cidade}`);
    if (data.nicho) parts.push(`Nicho: ${data.nicho}`);
    if (data.interesse) parts.push(`Interesse: ${data.interesse}`);
    if (data.etapa) parts.push(`Etapa: ${data.etapa}`);

    return parts.length > 0 ? `Dados conhecidos do lead:\n${parts.join('\n')}` : '';
  }

  private static rowToMemory(row: Record<string, unknown>): ContactMemory {
    const rawHistory = (row.conversation_history as unknown[]) || [];
    const parsedHistory: MemoryEntry[] = rawHistory
      .map((h: unknown) => {
        if (typeof h === 'string') { try { return JSON.parse(h); } catch { return null; } }
        if (typeof h === 'object' && h !== null) return h as MemoryEntry;
        return null;
      })
      .filter((h): h is MemoryEntry => h !== null);

    return {
      id: row.id as string,
      userId: row.user_id as string,
      contactJid: row.contact_jid as string,
      contactName: row.contact_name as string | null,
      extractedData: (row.extracted_data as ExtractedData) || {},
      conversationHistory: parsedHistory,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
