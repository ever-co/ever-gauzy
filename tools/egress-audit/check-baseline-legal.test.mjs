// node --test tools/egress-audit/check-baseline-legal.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { check, CONTENT_DIR, documentOf, hrefs, PAGES, readDocument, REPO_ROOT } from './check-baseline-legal.mjs';

const read = (path) => JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));
const BASELINE = read('tools/egress-audit/ui-baseline.json');
const PATH = 'tools/egress-audit/ui-baseline.json';
const hrefsOf = (document) => readDocument(document);

const entry = (route, url, attribute = 'href') => ({ route, attribute, url, reason: 'a test entry' });
const grown = (...added) => ({ ...BASELINE, entries: [...BASELINE.entries, ...added] });
const verdict = (current, base = BASELINE, pathAtBase = PATH) =>
	check({ current, base, path: PATH, pathAtBase, hrefsOf });

test('every legal page the walk opens renders a vendored document, and every document of the map is vendored', () => {
	const legal = read('tools/egress-audit/ui-routes.json')
		.routes.map((r) => r.path)
		.filter((p) => /^\/(pages\/)?legal(\/|$)/.test(p));
	assert.ok(legal.length >= 10, legal.join(', '));
	for (const route of legal) assert.notEqual(documentOf(route), null, route);
	for (const document of new Set(Object.values(PAGES)))
		assert.ok(readDocument(document)?.size > 0, `${CONTENT_DIR}/${document}.en.generated.ts`);
});

test('the DPIA links recorded for the DPIA pages are links its vendored document writes', () => {
	const dpia = (e) => /^\/(pages\/)?legal\/dpia$/.test(e.route) && /^https:\/\/gauzy\.co\/[a-z]/.test(e.url);
	const base = { ...BASELINE, entries: BASELINE.entries.filter((e) => !dpia(e)) };
	assert.deepEqual(verdict(BASELINE, base), { exit: 0, problems: [], added: 8 });
});

test('an href the vendored document writes is read as the browser writes it', () => {
	assert.deepEqual(
		[...hrefs('<a href="https://gauzy.co">x</a> <a href="https://gauzy.co/dpa">y</a> <a href="#s2">z</a>')],
		['https://gauzy.co/', 'https://gauzy.co/dpa']
	);
});

test('a link the page does not write, another route, another attribute or another document fail', () => {
	for (const added of [
		// a link no vendored document writes, on a legal page
		entry('/legal/dpia', 'https://api.ever.co/connect'),
		// a link the DPIA writes, on a page that is not a legal page
		entry('/pages/settings/usage-statistics', 'https://gauzy.co/dpa'),
		// a link the DPIA writes, on another legal page whose document does not write it
		entry('/legal/cookies', 'https://gauzy.co/dpa'),
		entry('/pages/legal/terms', 'https://gauzy.co/dpa'),
		// a route the legal pages do not have
		entry('/legal/dpia/extra', 'https://gauzy.co/dpa'),
		entry('/legal/unknown', 'https://gauzy.co/dpa'),
		// any attribute but href
		entry('/legal/dpia', 'https://gauzy.co/dpa', 'src')
	]) {
		const { exit, problems } = verdict(grown(added));
		assert.equal(exit, 1, JSON.stringify(added));
		assert.match(problems.join('\n'), new RegExp(`${added.route} ${added.attribute} ${added.url}`));
	}
});

test('the checks it repeats from the harness still fail (base_commit, shape, a moved or new baseline); a link the page writes passes', () => {
	assert.deepEqual(verdict(grown(entry('/legal/terms', 'https://www.cpdp.bg/'))), {
		exit: 0,
		problems: [],
		added: 1
	});
	assert.equal(verdict({ ...grown(), base_commit: '0000000' }).exit, 1);
	assert.equal(verdict(grown({ route: '/legal/dpia', attribute: 'href', url: 'https://gauzy.co/dpa' })).exit, 1);
	assert.equal(verdict(BASELINE, BASELINE, 'tools/egress-audit/other-baseline.json').exit, 1);
	assert.equal(verdict(BASELINE, null).exit, 1);
	assert.deepEqual(verdict(BASELINE), { exit: 0, problems: [], added: 0 });
});
