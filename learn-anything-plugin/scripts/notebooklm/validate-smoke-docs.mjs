#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DOCUMENTS = [
  {
    key: 'workflow',
    path: 'learn-anything-plugin/docs/notebooklm-smoke-workflow.md',
  },
  {
    key: 'report',
    path: 'learn-anything-plugin/docs/notebooklm-smoke-report.md',
  },
];

const CHECKS = [
  {
    name: 'workflow: prepared-only status',
    document: 'workflow',
    patterns: [/Status:\s*prepared only/i, /does not claim live NotebookLM execution/i],
  },
  {
    name: 'report: prepared-only status',
    document: 'report',
    patterns: [/Status:\s*prepared only/i, /every row remains `not run`/i],
  },
  {
    name: 'workflow: link-only source policy',
    document: 'workflow',
    patterns: [/link-only sources/i, /do not upload, download, or copy private source text/i],
  },
  {
    name: 'report: link-only evidence row',
    document: 'report',
    patterns: [/Link-only sources used/i],
  },
  {
    name: 'workflow: no local retrieval cache policy',
    document: 'workflow',
    patterns: [/No local retrieval cache/i, /local retrieval caches/i],
  },
  {
    name: 'report: no local retrieval cache evidence',
    document: 'report',
    patterns: [/No local retrieval cache created/i, /No local retrieval cache remains/i],
  },
  {
    name: 'workflow: metadata-only artifacts policy',
    document: 'workflow',
    patterns: [/Metadata-only artifacts/i, /notebook IDs, source IDs, safe labels/i],
  },
  {
    name: 'report: metadata-only artifacts row',
    document: 'report',
    patterns: [/Metadata-only artifacts retained/i],
  },
  {
    name: 'workflow: redaction and no secrets policy',
    document: 'workflow',
    patterns: [/Redaction and no secrets/i, /cookies, bearer headers, API keys/i, /SSH private/i],
  },
  {
    name: 'report: redaction and no secrets checklist',
    document: 'report',
    patterns: [/Redaction completed/i, /No tokens, cookies, bearer headers, API keys, SSH private data, or session files recorded/i],
  },
  {
    name: 'workflow: auth refresh once policy',
    document: 'workflow',
    patterns: [/Auth refresh once/i, /one auth refresh attempt/i],
  },
  {
    name: 'report: auth refresh once evidence',
    document: 'report',
    patterns: [/Refresh-auth attempted once on auth failure/i],
  },
  {
    name: 'workflow: no silent fallback policy',
    document: 'workflow',
    patterns: [/No silent fallback/i, /Do not silently continue as ordinary web research/i],
  },
  {
    name: 'report: no silent fallback evidence',
    document: 'report',
    patterns: [/No silent fallback to ordinary web research/i],
  },
  {
    name: 'workflow: failure modes visible',
    document: 'workflow',
    patterns: [/## 10\. Failure modes/i, /Transport unavailable/i, /Unexpected MCP response/i, /NotebookLM unavailable/i],
  },
  {
    name: 'report: failure modes table',
    document: 'report',
    patterns: [/## 8\. Failure modes and limitations/i, /Transport unavailable/i, /Unexpected MCP response/i],
  },
  {
    name: 'workflow: NotebookLM MCP capability recording',
    document: 'workflow',
    patterns: [/NotebookLM\/MCP capability results/i, /server_info/i, /notebook_query/i, /refresh_auth/i],
  },
  {
    name: 'report: NotebookLM MCP capability recording',
    document: 'report',
    patterns: [/NotebookLM\/MCP capability recording/i, /source_add YouTube/i, /notebook_query/i, /refresh_auth/i],
  },
  {
    name: 'workflow: report verdicts',
    document: 'workflow',
    patterns: [/## 13\. Final verdict/i, /`pass`/i, /`partial`/i, /`blocked`/i, /`not run`/i],
  },
  {
    name: 'report: report verdict fields',
    document: 'report',
    patterns: [/Verdict:\s*`not run`\s*\/\s*`pass`\s*\/\s*`partial`\s*\/\s*`blocked`/i, /Final human verdict/i],
  },
  {
    name: 'workflow: cleanup instructions',
    document: 'workflow',
    patterns: [/## 12\. Cleanup/i, /Stop the HTTP MCP server/i, /Delete local scratch logs/i],
  },
  {
    name: 'report: cleanup-safe retained evidence',
    document: 'report',
    patterns: [/Before sharing or committing this report/i, /Keep only compact observations, statuses, timestamps/i, /No local retrieval cache remains/i],
  },
];

export function validateDocuments(documents) {
  const missing = [];

  for (const { key, text, error } of documents) {
    if (error) {
      missing.push(`${key}: readable document (${error.message})`);
      continue;
    }

    if (typeof text !== 'string' || text.length === 0) {
      missing.push(`${key}: non-empty document`);
    }
  }

  const byKey = new Map(documents.map((document) => [document.key, document.text ?? '']));

  for (const check of CHECKS) {
    const text = byKey.get(check.document) ?? '';
    for (const pattern of check.patterns) {
      if (!pattern.test(text)) {
        missing.push(check.name);
        break;
      }
    }
  }

  return missing;
}

async function readSmokeDocuments() {
  return Promise.all(
    DOCUMENTS.map(async (document) => {
      try {
        const text = await readFile(document.path, 'utf8');
        return { ...document, text };
      } catch (error) {
        return { ...document, error };
      }
    }),
  );
}

async function main() {
  const documents = await readSmokeDocuments();
  const missing = validateDocuments(documents);

  if (missing.length > 0) {
    console.error('NotebookLM smoke docs validation failed:');
    for (const name of missing) {
      console.error(`- ${name}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`NotebookLM smoke docs validation passed (${CHECKS.length} checks).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
