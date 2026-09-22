#!/usr/bin/env node
/**
 * Gate: every gate is wired into CI.
 *
 * A check that nothing invokes is a check that measures nothing — and it is worse than no check, because its
 * presence in `tools/scripts` reads as coverage. Two of this repository's gates (the GraphQL composition check and
 * the schema check) sat unwired until this gate was written, on a surface — the composed schema — that four other
 * gates read from.
 *
 * The rule is deliberately about *files that are gates*: a script named `check-*.js`/`*.mjs` or `*-check.mjs` must
 * appear in the static-checks workflow. Probes, e2e suites, publishers and one-off tools are not gates and are not
 * required to be: they need a running installation or an argument to do anything, and that is a different job.
 *
 * Run from the repository root: `node tools/scripts/gate-wiring-check.mjs`
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPTS = join('tools', 'scripts');
const WORKFLOW = join('.github', 'workflows', 'static-checks.yml');

/** The naming a gate is recognised by. */
const IS_GATE = /^(check-[a-z0-9-]+\.(mjs|js)|[a-z0-9-]+-check\.mjs)$/;

const workflow = readFileSync(WORKFLOW, 'utf8');
const gates = readdirSync(SCRIPTS)
	.filter((name) => IS_GATE.test(name))
	.sort();

const unwired = gates.filter((name) => !workflow.includes(name));

if (unwired.length > 0) {
	console.error('FAILED — a gate exists and CI never runs it:');
	for (const name of unwired) console.error(`  tools/scripts/${name}`);
	console.error('');
	console.error(`Add it to ${WORKFLOW} (the step pattern is one gate per \`run:\`, with \`if: always()\` so a`);
	console.error('failure earlier in the job does not hide it). A gate nobody runs measures nothing.');
	process.exit(1);
}

console.log(
	`PASSED — all ${gates.length} gate(s) in tools/scripts are wired into static-checks.yml: ` +
		`${gates.join(', ')}.`
);
