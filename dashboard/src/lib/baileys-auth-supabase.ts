import { createAdminSupabaseClient } from './server-auth';

export const makeSupabaseAuthState = async (userId: string) => {
  const supabase = createAdminSupabaseClient();
  const baileys = await import('@whiskeysockets/baileys');
  const { initAuthCreds, proto } = baileys;

  const { data: existing } = await supabase
    .from('whatsapp_sessions')
    .select('creds, keys_json')
    .eq('user_id', userId)
    .maybeSingle();

  let creds: any = existing?.creds || initAuthCreds();
  let keysData: Record<string, any> = existing?.keys_json || {};

  let pendingWrite: ReturnType<typeof setTimeout> | null = null;
  const schedulePersist = () => {
    if (pendingWrite) clearTimeout(pendingWrite);
    pendingWrite = setTimeout(async () => {
      await supabase.from('whatsapp_sessions').upsert({
        user_id: userId,
        creds,
        keys_json: keysData,
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      pendingWrite = null;
    }, 300);
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          for (const id of ids) {
            const key = `${type}-${id}`;
            let value = keysData[key];
            if (type === 'app-state-sync-key' && value) {
              try { value = proto.Message.AppStateSyncKeyData.fromObject(value); } catch {}
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data: Record<string, Record<string, any>>) => {
          let changed = false;
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                if (keysData[key] !== value) {
                  keysData[key] = value;
                  changed = true;
                }
              } else {
                if (key in keysData) {
                  delete keysData[key];
                  changed = true;
                }
              }
            }
          }
          if (changed) schedulePersist();
        }
      }
    },
    saveCreds: async () => {
      schedulePersist();
    }
  };
};
