import { createRxDatabase, RxDatabase, RxCollection, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReplicationPluginModule from 'rxdb/plugins/replication';
import { replicateSupabase } from 'rxdb/plugins/replication-supabase';
import { SupabaseClient } from '@supabase/supabase-js';

// Import dev-mode only in development environment to help with CONFLICT errors
// In this specific sandbox environment, we'll enable it to provide the requested hints.
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
addRxPlugin(RxDBDevModePlugin);

// RxDB plugins from ESM.sh can sometimes have named exports missing or wrapped in a default object.
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
                // allowSlowCount=true prevents crashes when running .count() on non-indexed fields,
                // although we have now added indexes to the primary lookup fields.
                allowSlowCount: true,
                // Wrap Dexie storage with Ajv validation to satisfy dev-mode requirements
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

export const setupSupabaseReplication = async (db: FlowTaskDatabase, supabase: SupabaseClient) => {
    const replicationStates = [];
    const collections = ['projects', 'branches', 'tasks', 'people'];

    for (const name of collections) {
        try {
            const replicationState = replicateSupabase({
                collection: (db.collections as any)[name],
                supabase,
                tableName: `flowtask_${name}`,
                columnName: 'updated_at',
                pull: {
                    realtime: true
                },
                push: {}
            });
            replicationStates.push(replicationState);
        } catch (err) {
            console.error(`Errore durante l'inizializzazione della replicazione per ${name}:`, err);
        }
    }
    return replicationStates;
};