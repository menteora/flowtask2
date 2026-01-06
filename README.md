
# FlowTask 🌊 (RxDB Edition)

**FlowTask** è un gestore di progetti visivo ora potenziato da **RxDB**. Grazie a questa architettura, l'app è completamente reattiva e sincronizzata in tempo reale con Supabase, funzionando perfettamente anche offline.

## 🚀 Novità RxDB
*   **True Offline-First**: Le modifiche vengono salvate istantaneamente in locale e replicate in background.
*   **Reattività Totale**: UI aggiornata automaticamente tramite Observable (RxJS).
*   **Sincronizzazione Supabase**: Protocollo di replicazione integrato con gestione automatica dei checkpoint.

## 🗄️ Configurazione Database (Supabase)

Assicurati che le tabelle abbiano la colonna `updated_at` (timestamptz) e `deleted_at` per il soft delete.

```sql
-- Esempio per la tabella rami (ripetere logica per projects, tasks, people)
create table public.flowtask_branches (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null,
  responsible_id text,
  start_date text,
  end_date text,
  due_date text,
  archived boolean default false,
  collapsed boolean default false,
  is_label boolean default false,
  is_sprint boolean default false,
  sprint_counter integer default 1,
  parent_ids text[],
  children_ids text[],
  position integer default 0,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz
);

-- Abilita il Realtime per queste tabelle in Supabase
alter publication supabase_realtime add table flowtask_projects;
alter publication supabase_realtime add table flowtask_branches;
alter publication supabase_realtime add table flowtask_tasks;
alter publication supabase_realtime add table flowtask_people;
```
