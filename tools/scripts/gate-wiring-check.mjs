#!/usr/bin/env node
/**
 * Gate: every gate is wired into CI, and runs even when something before it failed.
 *
 * A check that nothing invokes is a check that measures nothing — and it is worse than no check, because its
 * presence in `tools/scripts` reads as coverage. Two of this repository's gates (the GraphQL composition check and
 * the schema check) sat unwired until this gate was written, on a surface — the composed schema — that four other
 * gates read from.
 *
 * The second rule is about the *step*, not the file. `static-checks.yml` states its own convention in a comment:
 * `if: always()` on every step after the first, "so one red gate still lets the rest report — otherwise the first
 * failure hides the others and each fix costs another full run to find the next one". Nothing enforced it, and a
 * gate that goes quiet exactly when an earlier one fails is a report that looks complete and is not.
 *
 * Probes, e2e suites, publishers and one-off tools are not gates and are not covered: they need a running
 * installation or an argument to do anything, which is a different job from a check that must always run.
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

/**
 * The steps of the workflow, in order, each with the job it belongs to and whether it is that job's first.
 *
 * Read line by line rather than with a parser so the comments that guard each step can be read too — one of them is
 * the convention this gate enforces.
 *
 * @returns One entry per `- name:` step.
 */
function steps() {
	const found = [];
	let job = null;
	const seenPerJob = new Map();

	for (const line of workflow.split(/\r?\n/)) {
		const jobHeader = /^ {2}([a-z0-9_-]+):\s*$/.exec(line);

		if (jobHeader) {
			job = jobHeader[1];
			continue;
		}

		if (job === null) continue;

		if (/^ {6}- name:/.test(line)) {
			const first = !(seenPerJob.get(job) ?? false);
			seenPerJob.set(job, true);
			found.push({ job, first, lines: [line] });
			continue;
		}

		if (found.length > 0) found[found.length - 1].lines.push(line);
	}

	return found;
}

const allSteps = steps();

const hidden = [];

for (const name of gates) {
	if (unwired.includes(name)) continue;

	const step = allSteps.find((candidate) => candidate.lines.join('\n').includes(`tools/scripts/${name}`));

	if (!step) continue;

	// The first step of a job cannot be hidden by anything: there is nothing before it to fail.
	if (step.first) continue;

	if (!step.lines.some((line) => /^\s*if:\s*always\(\)\s*$/.test(line))) hidden.push(name);
}

if (unwired.length > 0) {
	console.error('FAILED — a gate exists and CI never runs it:');
	for (const name of unwired) console.error(`  tools/scripts/${name}`);
	console.error('');
	console.error(`Add it to ${WORKFLOW}, with \`if: always()\` when it is not the job's first step. A gate nobody`);
	console.error('runs measures nothing.');
	process.exit(1);
}

if (hidden.length > 0) {
	console.error('FAILED — a gate runs only while the steps above it pass:');
	for (const name of hidden) console.error(`  tools/scripts/${name}`);
	console.error('');
	console.error('Add `if: always()` to its step — the convention this workflow already states in a comment. A failing');
	console.error('run is the one where the remaining gates matter most, and a report that stops at the first failure');
	console.error('reads as a complete one.');
	process.exit(1);
}

console.log(
	`PASSED — all ${gates.length} gate(s) in tools/scripts are wired into ${WORKFLOW}, each on a step that runs ` +
		`whether or not the steps above it passed: ${gates.join(', ')}.`
);
