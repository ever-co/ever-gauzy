// node --test tools/egress-audit/check-baseline-legal.test.mjs  (needs the harness: npm ci --prefix tools/egress-audit)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	CONTENT_DIR,
	covered,
	documentOf,
	hrefs,
	legalVerdict,
	PAGES,
	readDocument,
	REPO_ROOT
} from './check-baseline-legal.mjs';

const read = (path) => JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));
const PATH = 'tools/egress-audit/ui-baseline.json';
const BASE = { base_commit: '65c127cc62', entries: [] };

const entry = (route, url, attribute = 'href') => ({ route, attribute, url, reason: 'a test entry' });
const growth = (...added) => ({
	exit: 1,
	problems: [`${PATH} may only shrink; added since origin/develop:\n  ${added.map((e) => e.url).join('\n  ')}`]
});

/** A stand-in for the vendored documents: the DPIA links of @ever-co/legal 0.5.0, and the Terms'. */
const DOCUMENTS = {
	dpia: hrefs(
		'<a href="https://gauzy.co/dpa">DPA</a> <a href="https://gauzy.co/privacy">Privacy</a> ' +
			'<a href="https://gauzy.co/subprocessors">list</a> <a href="https://gauzy.co/security">Security</a>'
	),
	tos: hrefs('<a href="https://gauzy.co/tos">Terms</a>')
};
const hrefsOf = (document) => DOCUMENTS[document] ?? null;
const verdict = (added, harness = growth(...added)) =>
	legalVerdict({
		harness,
		current: { ...BASE, entries: [...BASE.entries, ...added] },
		base: BASE,
		path: PATH,
		hrefsOf
	});

const DPIA_LINKS = [
	'https://gauzy.co/dpa',
	'https://gauzy.co/privacy',
	'https://gauzy.co/security',
	'https://gauzy.co/subprocessors'
];

test('the DPIA links on both DPIA pages pass when the DPIA document writes them', () => {
	const added = ['/legal/dpia', '/pages/legal/dpia'].flatMap((route) => DPIA_LINKS.map((url) => entry(route, url)));
	assert.deepEqual(verdict(added), { exit: 0, problems: [], added: 8 });
});

test('every link the vendored DPIA writes is covered on both DPIA pages (the real files)', () => {
	const links = readDocument('dpia');
	assert.ok(links?.size > 0, `${CONTENT_DIR}/dpia.en.generated.ts`);
	for (const route of ['/legal/dpia', '/pages/legal/dpia'])
		for (const url of links) assert.equal(covered(entry(route, url), readDocument), true, `${route} ${url}`);
});

test('every legal page the walk opens renders a vendored document, and every document of the map is vendored', () => {
	const legal = read('tools/egress-audit/ui-routes.json')
		.routes.map((r) => r.path)
		.filter((p) => /^\/(pages\/)?legal(\/|$)/.test(p));
	assert.ok(legal.length >= 10, legal.join(', '));
	for (const route of legal) assert.notEqual(documentOf(route), null, route);
	for (const document of new Set(Object.values(PAGES)))
		assert.ok(readDocument(document)?.size > 0, `${CONTENT_DIR}/${document}.en.generated.ts`);
});

test('the links of a document are read as the browser leg records them', () => {
	assert.deepEqual(
		[
			...hrefs(
				'<a href="https://gauzy.co">x</a> <a class="l" href=\'https://gauzy.co/dpa#s2\'>y</a> ' +
					'<a href="https://gauzy.co/x?a=1&amp;b=2">z</a> <a href="#s2">in page</a>'
			)
		],
		['https://gauzy.co/', 'https://gauzy.co/dpa', 'https://gauzy.co/x?a=&b=']
	);
});

test('an attribute that is not the href of a link, or a commented-out link, counts for nothing', () => {
	assert.deepEqual(
		[
			...hrefs(
				'<div data-href="https://gauzy.co/a"></div> <a data-href="https://gauzy.co/b">b</a> ' +
					'<!-- <a href="https://gauzy.co/c">c</a> --> <link href="https://gauzy.co/d"> ' +
					'<p>href="https://gauzy.co/e"</p>'
			)
		],
		[]
	);
});

test('an href inside another quoted attribute value is not the link, and a quoted > does not end the tag', () => {
	assert.deepEqual(
		[...hrefs('<a title="href=\'https://gauzy.co/extra\'" href="https://gauzy.co/dpa">x</a>')],
		['https://gauzy.co/dpa']
	);
	assert.deepEqual([...hrefs('<a title="a > b" href="https://gauzy.co/dpa">x</a>')], ['https://gauzy.co/dpa']);
	assert.deepEqual([...hrefs('<a title="href=\'https://gauzy.co/extra\'">x</a>')], []);
	assert.deepEqual(
		[...hrefs('<a HREF="https://gauzy.co/dpa" href="https://gauzy.co/extra">x</a>')],
		['https://gauzy.co/dpa']
	);
});

test('a link the page does not write, another route, another attribute or another document fail', () => {
	for (const added of [
		// a link no vendored document writes, on a legal page
		entry('/legal/dpia', 'https://api.ever.co/connect'),
		// a link the DPIA writes, on a page that is not a legal page
		entry('/pages/settings/usage-statistics', 'https://gauzy.co/dpa'),
		// a link the DPIA writes, on another legal page whose document does not write it
		entry('/legal/terms', 'https://gauzy.co/dpa'),
		entry('/pages/legal', 'https://gauzy.co/dpa'),
		// a route the legal pages do not have
		entry('/legal/dpia/extra', 'https://gauzy.co/dpa'),
		entry('/legal/unknown', 'https://gauzy.co/dpa'),
		// any attribute but href
		entry('/legal/dpia', 'https://gauzy.co/dpa', 'src')
	]) {
		const { exit, problems } = verdict([added]);
		assert.equal(exit, 1, JSON.stringify(added));
		assert.ok(problems.join('\n').includes(`${added.route} ${added.attribute} ${added.url}`), problems.join('\n'));
	}
});

test('anything the harness reports besides growth stays a failure, even with covered entries', () => {
	const added = [entry('/legal/dpia', 'https://gauzy.co/dpa')];
	for (const problem of [
		'base_commit changed since origin/develop (65c127cc62 -> 0000000); it is fixed once the baseline exists',
		`${PATH} /additionalProperties must NOT have additional properties`,
		"base_commit 65c127cc62 is not a commit of this branch's history",
		`the baseline moved since origin/develop (${PATH} -> tools/egress-audit/other.json): a renamed or re-pointed baseline counts as growing it; keep the path`,
		`${PATH} is new since origin/develop: a baseline is adopted once, with --first-version in the change that adds it (a renamed baseline is new too)`
	]) {
		const harness = { exit: 1, problems: [...growth(...added).problems, problem] };
		assert.equal(verdict(added, harness).exit, 1, problem);
		assert.equal(verdict(added, { exit: 1, problems: [problem] }).exit, 1, problem);
	}
	assert.equal(verdict(added, { exit: 2, problems: ['the base x is not a commit of this repository'] }).exit, 2);
	assert.deepEqual(verdict([], { exit: 0, problems: [] }), { exit: 0, problems: [], added: 0 });
});
