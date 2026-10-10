#!/usr/bin/env node
// No dependency of the public default branch on a private ever-co repository.
//
// Anyone who clones `develop` must be able to install and build it. This scans every tracked
// package.json, yarn.lock and workflow for git dependencies on ever-co repositories
// (`github:ever-co/<repo>`, `git+https://github.com/ever-co/<repo>`, `git+ssh://git@github.com/ever-co/<repo>`,
// `git://github.com/ever-co/<repo>`) and workflow `uses: ever-co/<repo>/...` steps, and asks GitHub,
// WITHOUT credentials, whether each repository is public (its page answers 404 when private), and the
// check fails naming every file and line that refers to it. A published npm version never matches.
//
//   node tools/ever-platform/check-private-deps.mjs [--root <dir>]
//
// Exit codes: 0 every referenced ever-co repository is public, 1 a private one is referenced, 2 the
// check could not tell (GitHub answered something else, for example a rate limit).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OWNER = 'ever-co';
const PATTERNS = [
	/github:ever-co\/([A-Za-z0-9._-]+)/g,
	/git\+https:\/\/(?:[^@/\s"']+@)?github\.com\/ever-co\/([A-Za-z0-9._-]+)/g,
	/git\+ssh:\/\/git@github\.com[:/]ever-co\/([A-Za-z0-9._-]+)/g,
	/git:\/\/github\.com\/ever-co\/([A-Za-z0-9._-]+)/g,
	/uses:\s*["']?ever-co\/([A-Za-z0-9._-]+)/g
];

/** The tracked files that can declare a dependency. */
export function dependencyFiles(root) {
	const out = execFileSync('git', ['ls-files', '-z', '--', '*package.json', '*yarn.lock', '.github/workflows/*.yml', '.github/workflows/*.yaml'], {
		cwd: root,
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024
	});
	// The check's own fixtures name a private repository on purpose.
	return out
		.split('\0')
		.filter((f) => f && !f.includes('node_modules/') && !f.startsWith('tools/ever-platform/fixtures/'));
}

/** Every reference to an ever-co repository in one file: [{repo, file, line}]. */
export function findRefs(text, file) {
	const refs = [];
	const lines = text.split('\n');
	for (const [index, line] of lines.entries()) {
		for (const pattern of PATTERNS) {
			for (const match of line.matchAll(pattern)) {
				const repo = match[1].replace(/\.git$/, '').toLowerCase();
				refs.push({ repo, file, line: index + 1 });
			}
		}
	}
	return refs;
}

/**
 * Whether `ever-co/<repo>` is public, asked without credentials: the repository's page answers 200
 * to anyone when it is public and 404 when it is private (the web page, not the REST API, whose
 * anonymous rate limit shared CI addresses exhaust). true, false (404), or null (could not tell).
 */
export async function isPublicOnGitHub(repo, fetchImpl = fetch) {
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		const response = await fetchImpl(`https://github.com/${OWNER}/${encodeURIComponent(repo)}`, {
			method: 'HEAD',
			headers: { 'user-agent': 'ever-gauzy-private-deps-check' },
			redirect: 'follow'
		});
		if (response.status === 200) return true;
		if (response.status === 404) return false;
		if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
	}
	return null;
}

/** The verdict for a set of references: {exit, privateRefs[], unknown[]}. */
export async function check(refs, isPublic) {
	const verdicts = new Map();
	for (const repo of new Set(refs.map((r) => r.repo))) verdicts.set(repo, await isPublic(repo));
	const privateRefs = refs.filter((r) => verdicts.get(r.repo) === false);
	const unknown = [...verdicts].filter(([, v]) => v === null).map(([repo]) => repo);
	return { exit: privateRefs.length ? 1 : unknown.length ? 2 : 0, privateRefs, unknown, repos: [...verdicts.keys()] };
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
	process.stdout.write(
		`check-private-deps: ${refs.length} reference(s) to ${result.repos.length} ever-co repositories (${result.repos.join(', ') || 'none'}); ${
			result.exit === 0 ? 'all public' : result.exit === 1 ? 'a private repository is referenced' : 'inconclusive'
		}\n`
	);
	return result.exit;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
	main(process.argv.slice(2)).then(
		(code) => process.exit(code),
		(error) => {
			process.stderr.write(`check-private-deps: ${error.message}\n`);
			process.exit(2);
		}
	);
}
