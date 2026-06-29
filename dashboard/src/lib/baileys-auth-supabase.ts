import { createAdminSupabaseClient } from './server-auth';

const reviveBuffers = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(reviveBuffers);
  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return Buffer.from(obj.data);
  }
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      result[key] = reviveBuffers(obj[key]);
    }
    return result;
  }
  return obj;
};

export const makeSupabaseAuthState = async (userId: string, sessionId?: string) => {
  const supabase = createAdminSupabaseClient();
  const baileys = await import('@whiskeysockets/baileys');
  const { initAuthCreds, proto } = baileys;

  let query = supabase
    .from('whatsapp_sessions')
    .select('creds, keys_json, session_id');

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data: existing } = await query.maybeSingle();

  let creds: any = existing?.creds ? reviveBuffers(existing.creds) : initAuthCreds();
  let keysData: Record<string, any> = {};
  if (existing?.keys_json) {
    for (const [k, v] of Object.entries(existing.keys_json)) {
      keysData[k] = reviveBuffers(v);
    }
  }

  const rowSessionId = existing?.session_id || sessionId;

  let pendingWrite: ReturnType<typeof setTimeout> | null = null;
  const schedulePersist = () => {
    if (pendingWrite) clearTimeout(pendingWrite);
    pendingWrite = setTimeout(async () => {
      const record: Record<string, any> = {
        user_id: userId,
        creds,
        keys_json: keysData,
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (rowSessionId) {
        record.session_id = rowSessionId;
      }
      await supabase.from('whatsapp_sessions').upsert(record, {
        onConflict: rowSessionId ? 'session_id' : 'user_id'
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
              try { value = proto.Message.AppStateSyncKeyData.fromObject(value); } catch (e) { console.error(e); }
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
