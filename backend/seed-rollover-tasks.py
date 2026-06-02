import sqlite3
import json
import uuid
import time

DB_PATH = '/root/FamilyHub/backend/familyhub.db'
FAMILY_ID = '4906d1de-cb21-459d-966f-d6442780e0fb'
USERNAME = 'gutolm'
now = int(time.time() * 1000)

tasks = [
    # 1. Overdue Chore
    {
        "id": str(uuid.uuid4()),
        "collection": "chores",
        "title": "Comprar ração do cachorro",
        "description": "Comprar ração premium para o doguinho (Sabor Frango).",
        "assigned_to": USERNAME,
        "co_responsible": "none",
        "frequency": "custom",
        "is_medication": False,
        "points_worth": 40,
        "deleted": 0,
        "start_date": "2026-05-25",
        "end_date": "2026-06-01", # Overdue (Today is 2026-06-02)
        "repeats": False,
        "completed_dates": [],
        "updated_at": now
    },
    # 2. Due Today Chore
    {
        "id": str(uuid.uuid4()),
        "collection": "chores",
        "title": "Regar as plantas da varanda",
        "description": "Regar com cuidado para não encharcar o vaso de suculentas.",
        "assigned_to": "all",
        "co_responsible": "none",
        "frequency": "custom",
        "is_medication": False,
        "points_worth": 20,
        "deleted": 0,
        "start_date": "2026-06-02",
        "end_date": "2026-06-02", # Due Today
        "repeats": False,
        "completed_dates": [],
        "updated_at": now
    },
    # 3. Due Soon Chore
    {
        "id": str(uuid.uuid4()),
        "collection": "chores",
        "title": "Limpar filtros do ar condicionado",
        "description": "Lavar os filtros de nylon com água morna e sabão neutro.",
        "assigned_to": USERNAME,
        "co_responsible": "none",
        "frequency": "custom",
        "is_medication": False,
        "points_worth": 50,
        "deleted": 0,
        "start_date": "2026-06-02",
        "end_date": "2026-06-04", # Due Soon (In 2 days)
        "repeats": False,
        "completed_dates": [],
        "updated_at": now
    },
    # 4. Overdue Medication
    {
        "id": str(uuid.uuid4()),
        "collection": "chores",
        "title": "Amoxicilina 500mg",
        "description": "Tomar uma cápsula com água logo após a principal refeição.",
        "assigned_to": USERNAME,
        "co_responsible": "none",
        "frequency": "custom",
        "is_medication": True,
        "points_worth": 15,
        "deleted": 0,
        "start_date": "2026-05-28",
        "end_date": "2026-06-01", # Overdue
        "repeats": False,
        "medication_cycle": ["1 cápsula"],
        "completed_dates": [],
        "updated_at": now
    },
    # 5. Due Today Medication
    {
        "id": str(uuid.uuid4()),
        "collection": "chores",
        "title": "Ibuprofeno 600mg",
        "description": "Tomar se sentir dores nas costas ou articulações.",
        "assigned_to": "all",
        "co_responsible": "none",
        "frequency": "custom",
        "is_medication": True,
        "points_worth": 10,
        "deleted": 0,
        "start_date": "2026-06-02",
        "end_date": "2026-06-02", # Due Today
        "repeats": False,
        "medication_cycle": ["1 dose"],
        "completed_dates": [],
        "updated_at": now
    }
]

def seed_rollover_tasks():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("--- Inserindo Tarefas de Rollover no Banco do Backend ---")
    inserted = 0
    for task in tasks:
        payload = json.dumps(task)
        cursor.execute(
            '''INSERT OR REPLACE INTO sync_items (id, family_id, collection, encrypted_data, updated_at, deleted)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (task["id"], FAMILY_ID, task["collection"], payload, task["updated_at"], task["deleted"])
        )
        print(f"[OK] Semeado: [{task['collection'].upper()}] {task['title']} ({'Medicação' if task['is_medication'] else 'Rotina'})")
        inserted += 1
        
    conn.commit()
    conn.close()
    print(f"\n--- Semeado com sucesso {inserted} tarefas de teste! ---")

if __name__ == '__main__':
    seed_rollover_tasks()
