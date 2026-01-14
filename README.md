
# FlowTask 🌊 (Dynamic Tree Edition)

**FlowTask** è un gestore di progetti visivo ora potenziato da una struttura ad albero dinamica basata su `parent_ids`.

## 🚀 Novità Strutturali
*   **Dynamic Tree**: La gerarchia dell'albero è determinata unicamente dal campo `parent_ids`.
*   **Root Detection**: Un ramo è considerato radice se tra i suoi genitori figura l'ID del progetto.
*   **Simplified Schema**: Rimossi i campi ridondanti `project_id` e `children_ids` dalla tabella dei rami.

## 🗄️ Configurazione Database (Supabase)

Assicurati che le tabelle abbiano la colonna `updated_at` (timestamptz) e `deleted_at` per il soft delete.

```sql
-- Tabella rami aggiornata
create table public.flowtask_branches (
  id text primary key,
  title text not null,
  description text,
  status text not null,
  type text default 'standard',
  responsible_id text,
  start_date text,
  end_date text,
  due_date text,
  archived boolean default false,
  collapsed boolean default false,
  sprint_counter integer default 1,
  parent_ids text[], -- Contiene IDs di rami genitori o l'ID del Progetto per i rami radice
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
