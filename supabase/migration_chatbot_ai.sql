-- Chatbot AI columns
ALTER TABLE public.chatbot_configs
  ADD COLUMN IF NOT EXISTS use_ai boolean not null default true,
  ADD COLUMN IF NOT EXISTS ai_instructions text not null default 'Você é um assistente de vendas amigável e profissional. Ajude clientes com dúvidas sobre serviços, agende reuniões e colete informações de contato.';
