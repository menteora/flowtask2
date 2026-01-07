
import { createRxDatabase, RxDatabase, RxCollection, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReplicationPluginModule from 'rxdb/plugins/replication';
import { replicateSupabase } from 'rxdb/plugins/replication-supabase';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { SupabaseClient } from '@supabase/supabase-js';

// Import dev-mode only in development environment
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBLeaderElectionPlugin);

// Estrazione sicura del plugin di replicazione base
const RxDBReplicationPlugin = (ReplicationPluginModule as any).RxDBReplicationPlugin || 
                               (ReplicationPluginModule as any).default?.RxDBReplicationPlugin || 
                               (ReplicationPluginModule as any).default;

if (RxDBReplicationPlugin) {
    addRxPlugin(RxDBReplicationPlugin);
}

export const projectSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        root_branch_id: { type: 'string' },
        owner_id: { type: 'string' },
        updated_at: { type: 'string' },
        deleted_at: { type: 'string' },
        version: { type: 'integer' }
    },
    required: ['id', 'name']
};

export const branchSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        project_id: { type: 'string', maxLength: 100 },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        responsible_id: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        due_date: { type: 'string' },
        archived: { type: 'boolean' },
        collapsed: { type: 'boolean' },
        is_label: { type: 'boolean' },
        is_sprint: { type: 'boolean' },
        sprint_counter: { type: 'integer' },
        parent_ids: { type: 'array', items: { type: 'string' } },
        children_ids: { type: 'array', items: { type: 'string' } },
        position: { type: 'integer' },
        updated_at: { type: 'string' },
        deleted_at: { type: 'string' },
        version: { type: 'integer' }
    },
    required: ['id', 'project_id', 'title'],
    indexes: ['project_id']
};

export const taskSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        branch_id: { type: 'string', maxLength: 100 },
        title: { type: 'string' },
        description: { type: 'string' },
        assignee_id: { type: 'string' },
        due_date: { type: 'string' },
        completed: { type: 'boolean' },
        completed_at: { type: 'string' },
        position: { type: 'integer' },
        pinned: { type: 'boolean' },
        updated_at: { type: 'string' },
        deleted_at: { type: 'string' },
        version: { type: 'integer' }
    },
    required: ['id', 'branch_id', 'title'],
    indexes: ['branch_id']
};

export const personSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        project_id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        initials: { type: 'string' },
        color: { type: 'string' },
        updated_at: { type: 'string' },
        deleted_at: { type: 'string' },
        version: { type: 'integer' }
    },
    required: ['id', 'project_id', 'name'],
    indexes: ['project_id']
};

export type FlowTaskCollections = {
    projects: RxCollection;
    branches: RxCollection;
    tasks: RxCollection;
    people: RxCollection;
};

export type FlowTaskDatabase = RxDatabase<FlowTaskCollections>;

let dbPromise: Promise<FlowTaskDatabase> | null = null;

export const getDatabase = async (): Promise<FlowTaskDatabase> => {
    if (!dbPromise) {
        dbPromise = (async () => {
            const db = await createRxDatabase<FlowTaskCollections>({
                name: 'flowtaskdb',
                allowSlowCount: true,
                storage: wrappedValidateAjvStorage({
                    storage: getRxStorageDexie()
                })
            });

            await db.addCollections({
                projects: { schema: projectSchema },
                branches: { schema: branchSchema },
                tasks: { schema: taskSchema },
                people: { schema: personSchema }
            });

            return db;
        })();
    }
    return dbPromise;
};

/**
 * Funzione di utilità per creare un client Supabase "sicuro" che non crasha
 * se il plugin di RxDB cerca la funzione 'channel' in posti inaspettati.
 */
const createSanitizedSupabaseClient = (client: SupabaseClient): any => {
    // Creiamo un proxy o un oggetto che eredita dal client originale
    const sanitized = Object.create(client);
    
    // Definizione di una funzione channel "sicura" (no-op)
    const safeChannel = () => ({
        subscribe: () => ({ unsubscribe: () => {} }),
        unsubscribe: () => {},
        track: () => {},
        on: () => ({ on: () => {} }),
        send: () => {}
    });

    // Se manca la funzione channel principale, la aggiungiamo
    if (typeof sanitized.channel !== 'function') {
        sanitized.channel = safeChannel;
    }

    // Se manca l'oggetto realtime o la sua funzione channel, li aggiungiamo
    if (!sanitized.realtime) {
        sanitized.realtime = { channel: safeChannel };
    } else if (typeof sanitized.realtime.channel !== 'function') {
        sanitized.realtime.channel = safeChannel;
    }

    return sanitized;
};

export const setupSupabaseReplication = async (db: FlowTaskDatabase, supabase: SupabaseClient) => {
    console.group('🛠️ FlowTask Replication Setup');
    
    if (!supabase) {
        console.error('❌ Errore: Client Supabase non fornito.');
        console.groupEnd();
        return [];
    }

    // Ispezione e Sanitizzazione
    const hasChannel = typeof (supabase as any).channel === 'function';
    const hasRealtime = !!(supabase as any).realtime;
    console.log('Stato Iniziale Client:', { hasChannel, hasRealtime });

    // Creiamo la versione sicura del client
    const safeSupabase = createSanitizedSupabaseClient(supabase);

    const replicationStates = [];
    const collections = ['projects', 'branches', 'tasks', 'people'];

    for (const name of collections) {
        try {
            const collection = (db.collections as any)[name];
            if (!collection) continue;

            console.log(`📡 Inizializzazione '${name}'...`);
            
            // Usiamo il client "safeSupabase" e forziamo realtime: false
            const replicationState = replicateSupabase({
                collection,
                supabase: safeSupabase,
                tableName: `flowtask_${name}`,
                columnName: 'updated_at',
                pull: {
                    realtime: false 
                },
                push: {}
            });
            
            replicationState.error$.subscribe(err => {
                console.error(`❌ Errore Replicazione [${name}]:`, err);
            });

            replicationStates.push(replicationState);
        } catch (err) {
            console.error(`🔥 Errore fatale durante inizializzazione '${name}':`, err);
        }
    }
    
    console.groupEnd();
    return replicationStates;
};
