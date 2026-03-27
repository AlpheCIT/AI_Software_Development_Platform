/**
 * ArangoDB Collection Initialization for QA Engine
 * Run this script to create all required collections.
 *
 * Usage: npx tsx src/graph/init-collections.ts
 */

import { Database } from 'arangojs';
import { DOCUMENT_COLLECTIONS, EDGE_COLLECTIONS } from './collections';
import { qaConfig } from '../config';

async function initCollections() {
  const db = new Database({
    url: qaConfig.arango.url,
    databaseName: qaConfig.arango.database,
    auth: {
      username: qaConfig.arango.username,
      password: qaConfig.arango.password,
    },
  });

  console.log(`Connecting to ArangoDB at ${qaConfig.arango.url}/${qaConfig.arango.database}...`);

  // Create document collections
  for (const name of DOCUMENT_COLLECTIONS) {
    try {
      const collection = db.collection(name);
      const exists = await collection.exists();
      if (!exists) {
        await collection.create();
        console.log(`  Created document collection: ${name}`);
      } else {
        console.log(`  Already exists: ${name}`);
      }
    } catch (error: any) {
      console.error(`  Failed to create ${name}:`, error.message);
    }
  }

  // Create edge collections
  for (const name of EDGE_COLLECTIONS) {
    try {
      const collection = db.collection(name);
      const exists = await collection.exists();
      if (!exists) {
        await db.createEdgeCollection(name);
        console.log(`  Created edge collection: ${name}`);
      } else {
        console.log(`  Already exists: ${name}`);
      }
    } catch (error: any) {
      console.error(`  Failed to create edge ${name}:`, error.message);
    }
  }

  // Create indexes for common queries
  try {
    const testCases = db.collection('qa_test_cases');
    await testCases.ensureIndex({
      type: 'persistent',
      fields: ['repositoryId'],
      name: 'idx_qa_test_cases_repo',
    });

    const runs = db.collection('qa_runs');
    await runs.ensureIndex({
      type: 'persistent',
      fields: ['repositoryId', 'startedAt'],
      name: 'idx_qa_runs_repo_time',
    });

    const executions = db.collection('qa_test_executions');
    await executions.ensureIndex({
      type: 'persistent',
      fields: ['runId'],
      name: 'idx_qa_executions_run',
    });

    const failures = db.collection('qa_failures');
    await failures.ensureIndex({
      type: 'persistent',
      fields: ['runId'],
      name: 'idx_qa_failures_run',
    });

    console.log('\n  Indexes created successfully');
  } catch (error: any) {
    console.error('  Failed to create indexes:', error.message);
  }

  console.log('\nQA Engine collections initialized!');
  console.log(`  ${DOCUMENT_COLLECTIONS.length} document collections`);
  console.log(`  ${EDGE_COLLECTIONS.length} edge collections`);
}

initCollections()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
