import { createAdminSupabaseClient } from '@/lib/server-auth';

export type AIAction =
  | { action: 'reply'; text: string }
  | { action: 'create_lead'; name: string; phone: string; notes: string }
  | { action: 'schedule'; date: string; time: string; notes: string }
  | { action: 'support_ticket'; subject: string; description: string }
  | { action: 'transfer_to_human'; reason: string }
  | { action: 'opt_out'; reason: string }
  | { action: 'ask_clarification'; question: string };

export type ActionResult = {
  type: AIAction['action'];
  success: boolean;
  replyText: string;
  details?: string;
};

const adminClient = createAdminSupabaseClient();

export class ChatbotExecutor {
  static async execute(userId: string, action: AIAction): Promise<ActionResult> {
    switch (action.action) {
      case 'reply':
        return {
          type: 'reply',
          success: true,
          replyText: action.text,
        };

      case 'create_lead':
        return this.executeCreateLead(userId, action);

      case 'schedule':
        return this.executeSchedule(userId, action);

      case 'support_ticket':
        return this.executeSupportTicket(userId, action);

      case 'transfer_to_human':
        return {
          type: 'transfer_to_human',
          success: true,
          replyText: 'Sua solicitação foi registrada. Um atendente humano entrará em contato em breve.',
          details: action.reason,
        };

      case 'opt_out':
        return {
          type: 'opt_out',
          success: true,
          replyText: 'Entendido! Não enviarei mais mensagens promocionais. Se precisar de ajuda, estou aqui.',
          details: action.reason,
        };

      case 'ask_clarification':
        return {
          type: 'ask_clarification',
          success: true,
          replyText: action.question,
        };

      default:
        return {
          type: 'reply',
          success: false,
          replyText: 'Desculpe, não entendi. Pode reformular?',
          details: `Unknown action: ${(action as AIAction).action}`,
        };
    }
  }

  private static async executeCreateLead(userId: string, action: AIAction & { action: 'create_lead' }): Promise<ActionResult> {
    try {
      const leadKey = `${action.name}|${action.phone || 'unknown'}`;

      const { error } = await adminClient
        .from('crm_leads')
        .upsert({
          user_id: userId,
          lead_key: leadKey,
          nome: action.name,
          telefone: action.phone || 'Não informado',
          stage: 'Novo',
          notes: action.notes || '',
          saved_at: new Date().toISOString(),
          payload: {},
        }, { onConflict: 'user_id, lead_key' });

      if (error) throw error;

      return {
        type: 'create_lead',
        success: true,
        replyText: `Ótimo! Cadastrei ${action.name} como lead no seu CRM.`,
        details: `Lead ${action.name} criado com sucesso.`,
      };
    } catch (err) {
      console.error('[ChatbotExecutor] Erro ao criar lead:', err);
      return {
        type: 'create_lead',
        success: false,
        replyText: 'Consegui anotar as informações, mas houve um erro ao salvar. Pode tentar novamente?',
        details: err instanceof Error ? err.message : 'Erro desconhecido',
      };
    }
  }

  private static async executeSchedule(userId: string, action: AIAction & { action: 'schedule' }): Promise<ActionResult> {
    try {
      const scheduledAt = `${action.date} ${action.time}`;

      const { error } = await adminClient
        .from('whatsapp_campaigns')
        .insert({
          user_id: userId,
          name: `Agendamento: ${action.notes?.slice(0, 40) || 'Compromisso'}`,
          message_template: action.notes || '',
          scheduled_at: scheduledAt,
          status: 'scheduled',
        });

      if (error) throw error;

      return {
        type: 'schedule',
        success: true,
        replyText: `Perfeito! Agendei para ${action.date} às ${action.time}.`,
        details: `Agendado em ${scheduledAt}`,
      };
    } catch (err) {
      console.error('[ChatbotExecutor] Erro ao agendar:', err);
      return {
        type: 'schedule',
        success: false,
        replyText: 'Tentei agendar, mas algo deu errado. Pode tentar novamente?',
        details: err instanceof Error ? err.message : 'Erro desconhecido',
      };
    }
  }

  private static async executeSupportTicket(userId: string, action: AIAction & { action: 'support_ticket' }): Promise<ActionResult> {
    try {
      const { error } = await adminClient
        .from('chatbot_conversations')
        .insert({
          user_id: userId,
          contact_jid: 'support_ticket',
          contact_name: action.subject,
          message_text: action.description,
          direction: 'incoming',
        });

      if (error) throw error;

      return {
        type: 'support_ticket',
        success: true,
        replyText: 'Seu ticket de suporte foi aberto! Nossa equipe vai responder em até 24h úteis.',
        details: `Ticket: ${action.subject}`,
      };
    } catch (err) {
      console.error('[ChatbotExecutor] Erro ao abrir ticket:', err);
      return {
        type: 'support_ticket',
        success: false,
        replyText: 'Não consegui abrir o ticket. Pode tentar novamente?',
        details: err instanceof Error ? err.message : 'Erro desconhecido',
      };
    }
  }

  static tryParseAction(text: string): AIAction | null {
    const cleaned = text.trim();
    const jsonMatch = cleaned.match(/(\{[\s\S]*"action"[\s\S]*\})/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.action && typeof parsed.action === 'string') {
        return parsed as AIAction;
      }
    } catch { /* not JSON */ }

    return null;
  }
}
