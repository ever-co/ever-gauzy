#!/usr/bin/env node
// No dependency of the public default branch on a private ever-co repository.
//
// Anyone who clones `develop` must be able to install and build it. This reads every tracked
// package.json (its dependency fields only: dependencies, devDependencies, optionalDependencies,
// peerDependencies, resolutions, overrides), yarn.lock (entry specs and `resolved` URLs) and workflow
// (`uses:` values only), finds the ones that install from an ever-co GitHub repository, and asks
// GitHub WITHOUT credentials whether each repository is public (its page answers 404 when it is
// private). A published npm version never matches; a `repository` or `bugs` link is not read.
//
// Dependency forms recognised: `github:ever-co/<repo>`, the shorthand `ever-co/<repo>`,
// `git+https://github.com/ever-co/<repo>`, `https://github.com/ever-co/<repo>.git`,
// `git+ssh://git@github.com[:/]ever-co/<repo>`, `git@github.com:ever-co/<repo>`,
// `git://github.com/ever-co/<repo>`.
//
//   node tools/ever-platform/check-private-deps.mjs [--root <dir>]
//
// Exit codes: 0 every referenced ever-co repository is public, 1 a private one is referenced, 2 the
// check could not tell (GitHub answered something else, for example a rate limit).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNER = 'ever-co';
const REPO = '([A-Za-z0-9._-]+)';
/** A dependency specification that installs from an ever-co GitHub repository (whole value). */
const SPEC_FORMS = [
	String.raw`^github:${OWNER}/${REPO}`,
	String.raw`^${OWNER}/${REPO}(?:#.*)?$`,
	String.raw`^git\+https://(?:[^@/\s]+@)?github\.com/${OWNER}/${REPO}`,
	String.raw`^https://(?:[^@/\s]+@)?github\.com/${OWNER}/${REPO}\.git(?:#.*)?$`,
	String.raw`^git\+ssh://git@github\.com[:/]${OWNER}/${REPO}`,
	String.raw`^git@github\.com:${OWNER}/${REPO}`,
	String.raw`^git://github\.com/${OWNER}/${REPO}`
].map((source) => new RegExp(source));
/**
 * The same forms inside a yarn.lock line (entry specs like `"pkg@github:ever-co/x#ref"`, `resolved` URLs).
 * The shorthand counts only after a quote, a space or the line start: `"@ever-co/<package>"` is an npm
 * scope, never a repository.
 */
const LOCK_FORMS = [
	String.raw`github:${OWNER}/${REPO}`,
	String.raw`git\+https://(?:[^@/\s"]+@)?github\.com/${OWNER}/${REPO}`,
	String.raw`git\+ssh://git@github\.com[:/]${OWNER}/${REPO}`,
	String.raw`git@github\.com:${OWNER}/${REPO}`,
	String.raw`(?:^|[\s"'])${OWNER}/${REPO}(?=[#\s"':]|$)`,
	String.raw`git://github\.com/${OWNER}/${REPO}`,
	String.raw`https://(?:codeload\.)?github\.com/${OWNER}/${REPO}(?:\.git|/tar\.gz/)`
].map((source) => new RegExp(source, 'g'));
const USES = new RegExp(String.raw`^\s*-?\s*uses:\s*["']?${OWNER}/${REPO}`);
const DEPENDENCY_FIELDS = [
	'dependencies',
	'devDependencies',
	'optionalDependencies',
	'peerDependencies',
	'resolutions',
	'overrides'
];

const normalise = (repo) => repo.replace(/\.git$/, '').toLowerCase();

/** The tracked files that can declare a dependency (the check's own fixtures excepted). */
export function dependencyFiles(root) {
	const out = execFileSync(
		'git',
		['ls-files', '-z', '--', '*package.json', '*yarn.lock', '.github/workflows/*.yml', '.github/workflows/*.yaml'],
		{ cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
	);
	return out
		.split('\0')
		.filter((f) => f && !f.includes('node_modules/') && !f.startsWith('tools/ever-platform/fixtures/'));
}

/** The ever-co repository a dependency specification installs from, or null. */
export function repoOfSpec(spec) {
	if (typeof spec !== 'string') return null;
	const value = spec.trim();
	for (const form of SPEC_FORMS) {
		const match = form.exec(value);
		if (match) return normalise(match[1]);
	}
	return null;
}

/** The 1-based line of the first occurrence of `needle` in `text` (1 when not found). */
function lineOf(text, needle) {
	const at = text.indexOf(needle);
	return at < 0 ? 1 : text.slice(0, at).split('\n').length;
}

/** Every dependency value of a package.json (nested `overrides` included): [[name, value]]. */
function dependencyValues(manifest) {
	let values = [];
	const walk = (node, prefix) => {
		for (const [name, value] of Object.entries(node ?? {})) {
			if (typeof value === 'string') values.push([`${prefix}${name}`, value]);
			else if (value && typeof value === 'object') walk(value, `${prefix}${name}/`);
		}
	};
	for (const field of DEPENDENCY_FIELDS) walk(manifest?.[field], `${field}.`);
	return values;
}

/** The references of a package.json: its dependency values that install from an ever-co repository. */
function manifestRefs(text, file) {
	let manifest;
	try {
		manifest = JSON.parse(text);
	} catch {
		return [];
	}
	let refs = [];
	for (const [, value] of dependencyValues(manifest)) {
		const repo = repoOfSpec(value);
		if (repo) refs.push({ repo, file, line: lineOf(text, JSON.stringify(value)) });
	}
	return refs;
}

/** The references of a yarn.lock line. */
function lockRefs(line, file, lineNumber) {
	let refs = [];
	for (const form of LOCK_FORMS)
		for (const match of line.matchAll(form)) refs.push({ repo: normalise(match[1]), file, line: lineNumber });
	return refs;
}

/** Every reference to an ever-co repository in one file: [{repo, file, line}]. */
export function findRefs(text, file) {
	if (file.endsWith('package.json')) return manifestRefs(text, file);
	const lockfile = file.endsWith('yarn.lock');
	return text.split('\n').flatMap((line, index) => {
		if (lockfile) return lockRefs(line, file, index + 1);
		const match = USES.exec(line);
		return match ? [{ repo: normalise(match[1]), file, line: index + 1 }] : [];
	});
}

/**
 * Whether `ever-co/<repo>` is public, asked without credentials: the repository's page answers 200
 * to anyone when it is public and 404 when it is private (the web page, not the REST API, whose
 * anonymous rate limit shared CI addresses exhaust). true, false (404), or null (could not tell).
 */
export async function isPublicOnGitHub(repo, fetchImpl = fetch, waitMs = 2000) {
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		// One question at a time, with a pause between retries: this is a polite, anonymous check.
		// eslint-disable-next-line no-await-in-loop
		const response = await fetchImpl(`https://github.com/${OWNER}/${encodeURIComponent(repo)}`, {
			method: 'HEAD',
			headers: { 'user-agent': 'ever-gauzy-private-deps-check' },
			redirect: 'follow'
		});
		if (response.status === 200) return true;
		if (response.status === 404) return false;
		// eslint-disable-next-line no-await-in-loop
		if (attempt < 3) await new Promise((r) => setTimeout(r, waitMs * attempt));
	}
	return null;
}

/** The exit code of a verdict: 1 a private repository, 2 inconclusive, 0 all public. */
function exitOf(privateRefs, unknown) {
	if (privateRefs.length) return 1;
	if (unknown.length) return 2;
	return 0;
}

/** The verdict for a set of references: {exit, privateRefs[], unknown[], repos[]}. */
export async function check(refs, isPublic) {
	const repos = [...new Set(refs.map((r) => r.repo))];
	const answers = await Promise.all(repos.map((repo) => isPublic(repo)));
	let verdicts = new Map(repos.map((repo, i) => [repo, answers[i]]));
	const privateRefs = refs.filter((r) => verdicts.get(r.repo) === false);
	const unknown = repos.filter((repo) => verdicts.get(repo) === null);
	return { exit: exitOf(privateRefs, unknown), privateRefs, unknown, repos };
}

function summary(result, count) {
	let verdict = 'all public';
	if (result.exit === 1) verdict = 'a private repository is referenced';
	if (result.exit === 2) verdict = 'inconclusive';
	return `check-private-deps: ${count} reference(s) to ${result.repos.length} ever-co repositories (${result.repos.join(', ') || 'none'}); ${verdict}\n`;
}

async function main(argv) {
	const at = argv.indexOf('--root');
	const root = resolve(at >= 0 ? argv[at + 1] : '.');
	const refs = dependencyFiles(root).flatMap((file) => findRefs(readFileSync(join(root, file), 'utf8'), file));
	const result = await check(refs, (repo) => isPublicOnGitHub(repo));
	for (const r of result.privateRefs)
		process.stdout.write(`${r.file}:${r.line}: depends on the private repository ${OWNER}/${r.repo}\n`);
	for (const repo of result.unknown)
		process.stdout.write(`could not tell whether ${OWNER}/${repo} is public (GitHub did not answer 200 or 404)\n`);
	process.stdout.write(summary(result, refs.length));
	return result.exit;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		process.exitCode = await main(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`check-private-deps: ${error.message}\n`);
		process.exitCode = 2;
	}
}
