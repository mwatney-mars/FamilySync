import { run, query } from './db.js';
import crypto from 'crypto';

const FAMILY_ID = 'b0b216fd-19d4-4920-98e7-e398ff46da2a';
const USERNAME = 'gutolm';

const now = Date.now();

// Mock Routines (is_medication: false)
const routines = [
  {
    id: crypto.randomUUID(),
    collection: 'chores',
    title: 'Lavar a louça do jantar',
    description: 'Deixar a pia limpa, secar e guardar os pratos.',
    assigned_to: USERNAME,
    co_responsible: 'none',
    frequency: 'daily',
    is_medication: false,
    points_worth: 30,
    deleted: 0,
    start_date: '2026-06-01',
    end_date: null,
    repeats: true,
    recurrence_type: 'daily',
    recurrence_interval: 1,
    time_type: 'fixed',
    fixed_time: '20:30',
    completed_dates: [],
    updated_at: now
  },
  {
    id: crypto.randomUUID(),
    collection: 'chores',
    title: 'Arrumar a cama',
    description: 'Esticar os lençóis e arrumar os travesseiros logo após acordar.',
    assigned_to: USERNAME,
    co_responsible: 'none',
    frequency: 'daily',
    is_medication: false,
    points_worth: 15,
    deleted: 0,
    start_date: '2026-06-01',
    end_date: null,
    repeats: true,
    recurrence_type: 'daily',
    recurrence_interval: 1,
    time_type: 'period',
    period_time: 'manha',
    completed_dates: [],
    updated_at: now
  },
  {
    id: crypto.randomUUID(),
    collection: 'chores',
    title: 'Levar o lixo para fora',
    description: 'Levar os sacos de lixo orgânico e reciclável para a lixeira externa do condomínio.',
    assigned_to: 'all',
    co_responsible: 'none',
    frequency: 'weekly',
    is_medication: false,
    points_worth: 20,
    deleted: 0,
    start_date: '2026-06-01',
    end_date: null,
    repeats: true,
    recurrence_type: 'weekly',
    recurrence_interval: 1,
    recurrence_days: ['Seg', 'Qua', 'Sex'],
    time_type: 'period',
    period_time: 'noite',
    completed_dates: [],
    updated_at: now
  }
];

// Mock Medications (is_medication: true)
const medications = [
  {
    id: crypto.randomUUID(),
    collection: 'chores',
    title: 'Paracetamol 750mg',
    description: 'Tomar 1 comprimido de 8 em 8 horas se persistir a dor.',
    assigned_to: USERNAME,
    co_responsible: 'none',
    frequency: 'daily',
    is_medication: true,
    points_worth: 10,
    deleted: 0,
    start_date: '2026-06-01',
    end_date: '2026-06-05',
    repeats: true,
    recurrence_type: 'daily',
    recurrence_interval: 1,
    time_type: 'fixed',
    fixed_time: '08:00',
    medication_cycle: ['1 comprimido', '1 comprimido', '1 comprimido', '1 comprimido', '1 comprimido'],
    completed_dates: [],
    updated_at: now
  },
  {
    id: crypto.randomUUID(),
    collection: 'chores',
    title: 'Vitamina D 2000UI',
    description: 'Tomar uma cápsula com água logo após o café da manhã.',
    assigned_to: USERNAME,
    co_responsible: 'none',
    frequency: 'daily',
    is_medication: true,
    points_worth: 10,
    deleted: 0,
    start_date: '2026-06-01',
    end_date: null,
    repeats: true,
    recurrence_type: 'daily',
    recurrence_interval: 1,
    time_type: 'period',
    period_time: 'manha',
    medication_cycle: ['1 cápsula'],
    completed_dates: [],
    updated_at: now
  }
];

// Mock Shopping Items (Groceries)
const groceries = [
  {
    id: crypto.randomUUID(),
    collection: 'shopping',
    name: 'Leite Integral',
    quantity: '2 caixas',
    category: 'Alimentos',
    added_by: USERNAME,
    checked: 0,
    deleted: 0,
    updated_at: now
  },
  {
    id: crypto.randomUUID(),
    collection: 'shopping',
    name: 'Papel Higiênico',
    quantity: '1 pacote (12 rolos)',
    category: 'Higiene',
    added_by: USERNAME,
    checked: 0,
    deleted: 0,
    updated_at: now
  },
  {
    id: crypto.randomUUID(),
    collection: 'shopping',
    name: 'Maçã Gala',
    quantity: '1 kg',
    category: 'Hortifruti',
    added_by: USERNAME,
    checked: 0,
    deleted: 0,
    updated_at: now
  },
  {
    id: crypto.randomUUID(),
    collection: 'shopping',
    name: 'Iogurte Natural',
    quantity: '4 potes',
    category: 'Alimentos',
    added_by: USERNAME,
    checked: 1,
    checked_by: USERNAME,
    deleted: 0,
    updated_at: now
  }
];

async function seed() {
  console.log('--- Iniciando Semeadura de Dados de Teste ---');
  
  // Agrupar todos os itens para inserção
  const allItems = [...routines, ...medications, ...groceries];
  
  let insertedCount = 0;
  
  for (const item of allItems) {
    try {
      const encryptedPayload = JSON.stringify(item);
      
      // Inserir na tabela sync_items do banco do backend
      await run(
        `INSERT OR REPLACE INTO sync_items (id, family_id, collection, encrypted_data, updated_at, deleted) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.id, FAMILY_ID, item.collection, encryptedPayload, item.updated_at, item.deleted]
      );
      
      console.log(`[OK] Semeado: [${item.collection.toUpperCase()}] ${item.title || item.name}`);
      insertedCount++;
    } catch (err) {
      console.error(`[ERRO] Falha ao semear item: ${item.title || item.name}`, err);
    }
  }
  
  console.log(`\n--- Semeadura Concluída! ${insertedCount} itens adicionados/atualizados com sucesso! ---`);
  process.exit(0);
}

seed();
