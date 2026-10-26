#!/usr/bin/env node
/**
 * Gate: a pull request into develop does not start a workflow.
 *
 * Owner decision, 2026-09-21: the Actions minutes spent on every commit of a branch being merged into develop
 * were the largest recurring cost this repository had. The run belongs to the merge, so a workflow may be
 * triggered by `push` to develop and must not be triggered by a `pull_request` whose *base* is develop.
 *
 * A trigger is what starts a run, and GitHub evaluates the filter before any `if:` in the file — so a job-level
 * guard cannot express this. The only shapes that stop the run are the two this gate accepts:
 *
 *   - no `pull_request` trigger at all, or
 *   - a `pull_request` trigger whose branch filter cannot match develop: `branches-ignore` listing develop.
 *
 * Everything else that a reasonable person might write is refused, including the tempting `paths:`-only filter
 * (which narrows by what changed, not by the base branch) and `pull_request_target` (which is a pull_request
 * event with more privilege, not less cost).
 *
 * Run from the repository root: `node tools/scripts/pr-trigger-check.mjs`
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join('.github', 'workflows');

/** The events that start a run for a pull request. */
const PULL_REQUEST_EVENTS = ['pull_request', 'pull_request_target'];

/**
 * The triggers a workflow declares, as `{ event: config }`.
 *
 * Read by hand rather than with a YAML parser, because the repository's workflows carry comments that a parser
 * discards and one of them is the record of this very decision. The shapes below are the ones a workflow in this
 * repository actually uses; an `on:` block the reader cannot make sense of is reported rather than skipped.
 *
 * @param source The workflow file's text.
 * @returns The event names, with their configuration when one is stated.
 */
function triggersOf(source) {
	const lines = source.split(/\r?\n/);
	const start = lines.findIndex((line) => /^on:/.test(line));

	if (start === -1) return { events: {}, unreadable: true };

	const events = {};
	const inline = lines[start].replace(/^on:\s*/, '').trim();

	if (inline.startsWith('[')) {
		for (const name of inline.replace(/[[\]]/g, '').split(',')) events[name.trim()] = null;

		return { events, unreadable: false };
	}

	let current = null;
	let indent = null;

	for (let index = start + 1; index < lines.length; index++) {
		const line = lines[index];
		if (line.trim() === '') continue;
		if (/^[A-Za-z_]/.test(line)) break;

		const depth = line.length - line.trimStart().length;
		if (indent === null) indent = depth;

		if (depth === indent) {
			current = line.trim().replace(/:.*$/, '');
			events[current] = {};
			continue;
		}

		if (current === null) continue;

		const key = /^\s*([A-Za-z_-]+):/.exec(line)?.[1];
		if (!key) continue;

		const rest = line.replace(/^[^:]*:\s*/, '').trim();
		const values = rest.startsWith('[')
			? rest.replace(/[[\]]/g, '').split(',').map((value) => value.trim()).filter(Boolean)
			: [rest].filter(Boolean);

		// A list written one entry per line.
		if (rest === '') {
			for (let next = index + 1; next < lines.length; next++) {
				const candidate = lines[next];
				if (candidate.trim() === '') continue;
				if (candidate.length - candidate.trimStart().length <= depth) break;
				if (!/^\s*-\s/.test(candidate)) break;
				values.push(candidate.trim().replace(/^-\s*/, ''));
			}
		}

		events[current][key] = values;
	}

	return { events, unreadable: false };
}

const failures = [];

for (const name of readdirSync(DIR).sort()) {
	if (!/\.ya?ml$/.test(name)) continue;

	const { events, unreadable } = triggersOf(readFileSync(join(DIR, name), 'utf8'));

	if (unreadable) {
		failures.push(`${name} -> no \`on:\` block this gate can read`);
		continue;
	}

	for (const event of PULL_REQUEST_EVENTS) {
		if (!(event in events)) continue;

		const config = events[event] ?? {};
		const ignores = config['branches-ignore'] ?? [];
		const branches = config.branches ?? null;

		// Acceptable when the filter cannot match develop: an ignore-list that names it, or an allow-list that
		// does not. A filter that narrows by `paths:` alone is not a branch filter — a pull request into develop
		// that touches the path still starts the run, which is the cost this gate exists to stop.
		if (ignores.includes('develop')) continue;
		if (branches !== null && !branches.includes('develop')) continue;

		failures.push(
			`${name} -> \`${event}\` can start a run for a pull request into develop` +
				(branches ? ` (\`branches: [${branches.join(', ')}]\`)` : ' (no branch filter)')
		);
	}
}

if (failures.length > 0) {
	console.error('FAILED — a pull request into develop would start a workflow:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error('The run belongs to the merge, not to the branch being merged: leave the `push` trigger and either');
	console.error('drop the pull-request trigger or exempt develop with `branches-ignore: [develop]`.');
	process.exit(1);
}

console.log(
	'PASSED — no workflow starts a run for a pull request into develop; the triggers that remain are pushes to a\n' +
		'branch, schedules, manual dispatches and pull requests aimed at other branches.'
);
