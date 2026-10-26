// node --test tools/egress-audit/patch-mock-clock.test.mjs  (needs the harness: npm ci --prefix tools/egress-audit)
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { AFTER, BEFORE, patchSource, STATE_FILE } from './patch-mock-clock.mjs';

const DAY = 86_400;
const copies = [];

after(() => {
	for (const dir of copies) rmSync(dir, { recursive: true, force: true });
});

/**
 * The mock platform's `MockState`, loaded from a private copy of the installed sources — patched or as
 * installed — so the shared install is never written to.
 */
async function mockState(patched) {
	const dir = mkdtempSync(join(tmpdir(), 'mock-clock-'));
	copies.push(dir);
	cpSync(dirname(STATE_FILE), dir, { recursive: true });
	const file = join(dir, 'state.mjs');
	const source = readFileSync(file, 'utf8');
	writeFileSync(file, patched ? patchSource(source).source : source);
	const { MockState, makeConfig } = await import(pathToFileURL(file).href);
	return new MockState(makeConfig({ clock: { real: true } }));
}

/** The entitlement bucket the mock keys per installation and path, as `entitlementAnswer` uses it. */
const read = (state) => state.bucket('entitlement|inst_1|instance', 60, 3600);

test('as installed, a read after the clock is moved back 8 days is refused for about 8 days (the ladder’s grace step)', async () => {
	const state = await mockState(false);

	assert.equal(read(state), 0); // the installation's read at connect, at real time
	state.offset = -8 * DAY; // POST /__mock/clock { set: now - 8 days }

	assert.ok(read(state) > 7 * DAY, 'the bucket refuses with a retry-after of days');
});

test('patched, the same read is answered: a clock moved back past the window starts the bucket afresh', async () => {
	const state = await mockState(true);

	assert.equal(read(state), 0);
	state.offset = -8 * DAY;
	assert.equal(read(state), 0);
	state.offset = -38 * DAY;
	assert.equal(read(state), 0);
	state.offset = 0; // back to real time, as the ladder does after each step
	assert.equal(read(state), 0);
});

test('patched, the limit still holds at a steady clock: a seventh read of a six-an-hour bucket waits', async () => {
	const state = await mockState(true);
	const six = () => state.bucket('entitlement|inst_1|instance', 6, 3600);

	for (let i = 0; i < 6; i++) assert.equal(six(), 0, `read ${i + 1}`);
	assert.ok(six() > 0, 'the seventh read is refused');
});

test('the patch replaces exactly one line, is idempotent, and refuses a source it was not written for', () => {
	const source = `class X {\n  bucket(key, limit, windowS) {\n    const now = this.now();\n${BEFORE}\n  }\n}\n`;
	const once = patchSource(source);

	assert.equal(once.changed, true);
	assert.ok(once.source.includes(AFTER));
	assert.ok(!once.source.includes(BEFORE));
	assert.deepEqual(patchSource(once.source), { source: once.source, changed: false });
	assert.throws(() => patchSource('class X {}'), /harness changed/);
});
