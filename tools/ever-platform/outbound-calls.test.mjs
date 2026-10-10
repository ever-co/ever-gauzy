// node --test tools/ever-platform/outbound-calls.test.mjs (after npm ci --prefix tools/egress-audit)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	check,
	DOCS,
	loadRows,
	normalised,
	notMade,
	readmeTable,
	renderDocs,
	REPO_ROOT,
	usedRows
} from './outbound-calls.mjs';

const CONFIG = JSON.parse(readFileSync(join(REPO_ROOT, 'tools/ever-platform/outbound-calls.config.json'), 'utf8'));
const contract = loadRows();

test('the docs page, the READMEs and the egress audit are in step with the pinned contract', () => {
	assert.deepEqual(check(contract), []);
});

test('a README row the module does not make, or a request outside its row, fails', () => {
	const problems = check(contract, {
		...CONFIG,
		readmes: { connect: 'tools/ever-platform/fixtures/outbound-bad/README.md' }
	});
	assert.ok(
		problems.some((p) => /lists rows 1, 3, 25, 4, 5,/.test(p)),
		problems.join('\n')
	);
	assert.ok(
		problems.some((p) => p.includes('row 5 does not name DELETE /v1/instances/me/tenant-links/{link}')),
		problems.join('\n')
	);
	assert.ok(
		problems.some((p) => /row 4 names POST \/v1\/instances\/token\/refresh/.test(p)),
		problems.join('\n')
	);
});

test('an edited row of the generated table fails; padding by a formatter does not', () => {
	const docs = readFileSync(DOCS, 'utf8');
	const rendered = renderDocs(docs, contract);
	assert.equal(normalised(rendered), normalised(docs));
	const edited = rendered.replace('| 17 | statistics |', '| 17 | statistics (edited) |');
	assert.notEqual(normalised(edited), normalised(rendered));
	assert.equal(normalised('| a   | b |\n| --- | --- |'), normalised('| a | b |\n| ----- | --- |'));
});

test('every Gauzy row of the contract is either made or listed as not made', () => {
	const made = usedRows(contract.rows).map((u) => u.row.row);
	const missing = notMade(contract.rows).map((n) => n.row.row);
	const gauzy = contract.rows
		.filter((r) => r.products.includes('gauzy') && r.phase <= CONFIG.phase)
		.map((r) => r.row);
	assert.deepEqual(
		[...made, ...missing].sort((a, b) => a - b),
		gauzy.sort((a, b) => a - b)
	);
	assert.deepEqual(readmeTable('| 5 | `POST /a`, `DELETE /b` | x |'), [
		{ row: 5, requests: ['POST /a', 'DELETE /b'] }
	]);
});
