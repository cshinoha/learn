#!/usr/bin/env node
import { helpRequested, mcpCall, parseArgs, printJson, slugify } from './notebooklm-client.mjs';

const usage = `Usage: create-notebook.mjs --skill <slug> [--skill-id <id>] [--shard <name>]\n\nCreates or locates a NotebookLM notebook named: LA - <skill-slug> - <skill-id> - <shard>.`;
const args = parseArgs();
if (helpRequested(args)) {
  console.log(usage);
  process.exit(0);
}
const requestedSkill = args.skill || args._[0];
if (!requestedSkill) {
  console.error(usage);
  process.exit(2);
}
const skill = slugify(requestedSkill);
const skillId = args['skill-id'] || skill;
const shard = args.shard || 'research';
const name = `LA - ${skill} - ${skillId} - ${shard}`;
const result = await mcpCall('notebook_create', { title: name });
printJson({ name, skill, skill_id: skillId, shard, ...result });
