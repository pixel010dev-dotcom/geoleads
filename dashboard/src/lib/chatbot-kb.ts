import { createAdminSupabaseClient } from '@/lib/server-auth';

export type KBEntry = {
  id: string;
  userId: string;
  category: string;
  question: string;
  answer: string;
  enabled: boolean;
  createdAt: string;
};

export class ChatbotKnowledgeBase {
  private static adminClient = createAdminSupabaseClient();

  static async getActiveForUser(userId: string): Promise<KBEntry[]> {
    const { data, error } = await this.adminClient
      .from('chatbot_knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('category', { ascending: true });

    if (error) {
      console.error('[ChatbotKB] Erro ao buscar KB:', error);
      return [];
    }

    return (data || []).map(this.rowToEntry);
  }

  static async buildSystemContext(userId: string): Promise<string> {
    const entries = await this.getActiveForUser(userId);

    if (entries.length === 0) {
      return '';
    }

    const categorized = new Map<string, KBEntry[]>();
    for (const entry of entries) {
      const cat = entry.category;
      if (!categorized.has(cat)) categorized.set(cat, []);
      categorized.get(cat)!.push(entry);
    }

    let context = '\n\nINFORMAÇÕES DO NEGÓCIO (use como fonte única):\n';
    for (const [category, items] of categorized) {
      context += `\n[${category.toUpperCase()}]\n`;
      for (const item of items) {
        context += `- ${item.question}: ${item.answer}\n`;
      }
    }

    return context;
  }

  static async addEntry(
    userId: string,
    category: string,
    question: string,
    answer: string
  ): Promise<KBEntry | null> {
    const { data, error } = await this.adminClient
      .from('chatbot_knowledge_base')
      .insert({
        user_id: userId,
        category,
        question,
        answer,
      })
      .select()
      .single();

    if (error) {
      console.error('[ChatbotKB] Erro ao adicionar entrada:', error);
      return null;
    }

    return this.rowToEntry(data);
  }

  static async updateEntry(
    id: string,
    userId: string,
    updates: Partial<{ category: string; question: string; answer: string; enabled: boolean }>
  ): Promise<boolean> {
    const { error } = await this.adminClient
      .from('chatbot_knowledge_base')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[ChatbotKB] Erro ao atualizar entrada:', error);
      return false;
    }

    return true;
  }

  static async deleteEntry(id: string, userId: string): Promise<boolean> {
    const { error } = await this.adminClient
      .from('chatbot_knowledge_base')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[ChatbotKB] Erro ao deletar entrada:', error);
      return false;
    }

    return true;
  }

  static async getCategories(userId: string): Promise<string[]> {
    const { data, error } = await this.adminClient
      .from('chatbot_knowledge_base')
      .select('category')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (error) return [];
    const cats = [...new Set((data || []).map((r: Record<string, unknown>) => r.category as string))];
    return cats.sort();
  }

  private static rowToEntry(row: Record<string, unknown>): KBEntry {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      category: row.category as string,
      question: row.question as string,
      answer: row.answer as string,
      enabled: row.enabled as boolean,
      createdAt: row.created_at as string,
    };
  }
}
