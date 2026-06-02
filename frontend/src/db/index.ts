import Dexie from 'dexie';

// Classe do Banco de Dados Local Dexie
class FamilyHubDatabase extends Dexie {
  chores!: Dexie.Table<Chore, string>;
  shopping!: Dexie.Table<ShoppingItem, string>;
  comments!: Dexie.Table<ChoreComment, string>;
  rewards!: Dexie.Table<Reward, string>;
  points!: Dexie.Table<PointLog, string>;
  sync_queue!: Dexie.Table<SyncQueueEntry, string>;
  metadata!: Dexie.Table<{ key: string; value: any }, string>;

  ai_config!: Dexie.Table<AiConfig, string>;
  purchase_history!: Dexie.Table<PurchaseRecord, string>;

  constructor() {
    super('FamilyHubDB');
    // Upgrade do banco para a versão 2 com suporte ao salvamento sincronizado da configuração de IA
    this.version(2).stores({
      chores: 'id, collection, updated_at, deleted, completed_by',
      shopping: 'id, collection, updated_at, deleted, category, checked',
      comments: 'id, collection, updated_at, chore_id, instance_date',
      rewards: 'id, collection, updated_at, deleted',
      points: 'id, collection, updated_at, user_id, timestamp',
      sync_queue: 'id, item_id, collection, updated_at',
      metadata: 'key',
      ai_config: 'id, collection, updated_at'
    });
    // Upgrade do banco para a versão 3 com suporte ao histórico de compras e processamento assíncrono de IA
    this.version(3).stores({
      chores: 'id, collection, updated_at, deleted, completed_by',
      shopping: 'id, collection, updated_at, deleted, category, checked, ai_status',
      comments: 'id, collection, updated_at, chore_id, instance_date',
      rewards: 'id, collection, updated_at, deleted',
      points: 'id, collection, updated_at, user_id, timestamp',
      sync_queue: 'id, item_id, collection, updated_at',
      metadata: 'key',
      ai_config: 'id, collection, updated_at',
      purchase_history: 'id, collection, updated_at, name, bought_at'
    });
  }
}

export interface AiConfig {
  id: string; // ex: 'current_ai_config'
  collection: 'ai_config';
  gemini_api_key: string;
  ai_categorization_enabled: boolean;
  gemini_model?: string;
  updated_at: number;
}


// --- DEFINIÇÕES DE TIPOS ---

export interface Chore {
  id: string; // UUID v4 gerado no cliente
  collection: 'chores';
  title: string;
  description: string;
  assigned_to: string; // ID do usuário ou 'all'
  frequency: 'daily' | 'weekly' | 'custom';
  custom_recurrence?: {
    days: string[]; // ['Mon', 'Wed', 'Fri']
  };
  is_medication: boolean;
  medication_dosages?: {
    [key: string]: string; // ex: { 'Mon': '10mg', 'Tue': '5mg' }
  };
  points_worth: number;
  completed_by?: string | null; // ID do usuário que concluiu
  completed_at?: number | null; // timestamp ou null
  updated_at: number; // timestamp da última alteração
  deleted: number; // 0 ou 1

  // NOVOS CAMPOS ADVANCED SCHEDULING & MEDICAMENTOS
  start_date?: string; // Data de início "YYYY-MM-DD"
  end_date?: string | null; // Data de fim "YYYY-MM-DD"
  repeats?: boolean; // Se a tarefa se repete
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'custom_days';
  recurrence_interval?: number; // repetir a cada X dias/semanas/meses
  recurrence_days?: string[]; // dias da semana selecionados (ex: ['Seg', 'Qua'])
  co_responsible?: string; // Co-responsável ou 'none'
  medication_cycle?: string[]; // Ciclo sequencial de doses (ex: ['10mg', '5mg'])
  time_type?: 'all_day' | 'fixed' | 'period'; // Tipo de horário
  fixed_time?: string; // ex: "08:30"
  period_time?: 'manha' | 'tarde' | 'noite'; // período do dia
  completed_dates?: string[]; // Datas em que a rotina foi concluída ("YYYY-MM-DD")
}

export interface ShoppingItem {
  id: string;
  collection: 'shopping';
  name: string;
  quantity: string; // ex: "2 litros", "1kg"
  category: string; // ex: "Higiene", "Alimentos"
  added_by: string; // nome ou ID de quem adicionou
  checked: number; // 0 ou 1
  checked_by?: string; // nome do usuário que marcou
  updated_at: number;
  deleted: number;
  ai_status?: 'pending' | 'processed';
  is_archived?: number;
}

export interface PurchaseRecord {
  id: string;
  collection: 'purchase_history';
  shopping_item_id?: string;
  name: string;
  quantity: string;
  quantity_number: number;
  bought_at: number;
  bought_by: string;
  updated_at: number;
  deleted: number;
}

export interface ChoreComment {
  id: string;
  collection: 'comments';
  chore_id: string; // Referência à tarefa correspondente
  instance_date: string; // Data da ocorrência ("YYYY-MM-DD")
  sender_name: string; // Nome de quem enviou (ex: "Pai", "Mãe")
  comment_text: string; // Texto do comentário
  timestamp: number; // Data/Hora do envio
  updated_at: number; // Para sincronização
  deleted: number; // 0 ou 1 para soft deletes
}

export interface Reward {
  id: string;
  collection: 'rewards';
  title: string;
  description: string;
  cost_points: number;
  created_by: string;
  updated_at: number;
  deleted: number;
}

export interface PointLog {
  id: string;
  collection: 'points';
  user_id: string;
  user_name: string;
  points: number;
  reason: string; // ex: "Completou tarefa: Lavar a louça"
  timestamp: number;
  updated_at: number;
}

export interface SyncQueueEntry {
  id: string; // UUID
  item_id: string; // ID do item nas tabelas acima (ex: chores.id)
  collection: 'chores' | 'shopping' | 'comments' | 'rewards' | 'points' | 'ai_config' | 'purchase_history';
  operation: 'insert' | 'update' | 'delete';
  updated_at: number;
}

export const db = new FamilyHubDatabase();

// --- FUNÇÕES AUXILIARES DE COORDENAÇÃO LOCAL ---

// Gerador de UUID robusto compatível com contextos não-seguros (HTTP local)
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Adiciona uma operação de sincronização na fila local
export async function queueSyncOperation(
  itemId: string,
  collection: SyncQueueEntry['collection'],
  operation: SyncQueueEntry['operation']
) {
  const syncId = generateUUID();
  await db.sync_queue.put({
    id: syncId,
    item_id: itemId,
    collection,
    operation,
    updated_at: Date.now()
  });
}
