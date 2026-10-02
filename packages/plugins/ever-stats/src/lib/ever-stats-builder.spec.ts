import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EverStatsBuilder, parseReleaseVersion } from './ever-stats-builder.service';
import { statsPeriod } from './ever-stats-collector.service';
import { MODULE_VERSION } from './ever-stats.constants';
import { STATS_SCHEMA } from './schema/stats-schema';
import { checkStatsBytes } from './vendor/stats-checks';

const FIXTURES = join(__dirname, 'schema/fixtures');
const expected = JSON.parse(readFileSync(join(FIXTURES, 'expected.json'), 'utf8')).fixtures as Record<
	string,
	{ status: number; path?: string; error?: string }
>;
const golden = JSON.parse(readFileSync(join(FIXTURES, 'valid/gauzy.json'), 'utf8'));

/** Every string of a value (keys included) with its JSON pointer. */
function walkStrings(value: unknown, at = ''): Array<{ path: string; value: string }> {
	if (typeof value === 'string') return [{ path: at, value }];
	if (Array.isArray(value)) return value.flatMap((item, i) => walkStrings(item, `${at}/${i}`));
	if (value !== null && typeof value === 'object') {
		return Object.entries(value).flatMap(([key, item]) => [{ path: `${at}/${key}`, value: key }, ...walkStrings(item, `${at}/${key}`)]);
	}
	return [];
}

describe('EverStatsBuilder', () => {
	const builder = new EverStatsBuilder();

	describe('the platform fixtures', () => {
		const invalid = readdirSync(join(FIXTURES, 'invalid')).sort();

		it('has every invalid fixture', () => {
			expect(invalid.length).toBeGreaterThanOrEqual(13);
		});

		it.each(invalid)('refuses invalid/%s with the platform path and code, so it is never sent', (name) => {
			const bytes = readFileSync(join(FIXTURES, 'invalid', name));
			const result = checkStatsBytes(STATS_SCHEMA, bytes) as { ok: boolean; status?: number; errors?: Array<{ path: string; code: string }> };
			const want = expected[`invalid/${name}`];
			expect(result.ok).toBe(false);
			expect(result.status).toBe(want.status);
			expect(result.errors?.[0].path).toBe(want.path);
			expect(result.errors?.[0].code).toBe(want.error);
		});

		it('accepts the gauzy golden', () => {
			expect(checkStatsBytes(STATS_SCHEMA, readFileSync(join(FIXTURES, 'valid/gauzy.json'))).ok).toBe(true);
			expect(builder.check(golden).ok).toBe(true);
		});

		it('refuses a parsed invalid report before sending, naming the field and never the value', () => {
			const report = { ...golden, country: 'ops@acme.example' };
			const result = builder.check(report);
			expect(result.ok).toBe(false);
			expect(result.built).toBeNull();
			expect(result.error).toBe('schema_violation:/country:pattern');
			expect(result.error).not.toContain('acme');
			const extra = builder.check({ ...golden, tenant_name: 'Acme Corp' });
			expect(extra.ok).toBe(false);
			expect(extra.error).toBe('schema_violation:/*:unknown_field');
		});
	});

	it('builds the golden shape from collected counters, valid as sent', () => {
		const now = new Date(Date.UTC(2026, 9, 3, 12, 30, 0));
		const result = builder.build({
			identity: { instanceId: golden.instance_id },
			config: { country: 'ZZ', serves: ['gauzy', 'teams'], installSource: 'self-hosted' },
			release: parseReleaseVersion('v0.750.1'),
			period: statsPeriod(now, 1),
			final: true,
			collected: { counts: golden.counts, features: golden.features, aggregates: golden.aggregates },
			now
		});
		expect(result.ok).toBe(true);
		const { report, text, bytes } = result.built as NonNullable<typeof result.built>;
		expect(bytes.toString('utf8')).toBe(text);
		expect(JSON.parse(text)).toEqual(report);
		const strip = ({ report_id, sent_at, instance_id, version, module_version, ...rest }: Record<string, unknown>) => rest;
		expect(strip(report)).toEqual(strip(golden));
		expect(report['report_id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(report['sent_at']).toBe('2026-10-03');
		expect(report['module_version']).toBe(MODULE_VERSION);
		expect(Object.keys(report)).toEqual([
			'schema', 'report_id', 'instance_id', 'sent_at', 'module_version', 'product', 'instance_kind', 'serves', 'version',
			'channel', 'install_source', 'country', 'period', 'final', 'counts', 'features', 'aggregates'
		]);
		// Every string sits at a place the schema names, and matches it (the checks ran on these bytes).
		for (const { value } of walkStrings(report)) {
			expect(value.length).toBeLessThanOrEqual(64);
		}
	});

	it('refuses a report over 16 KiB', () => {
		const counts = { ...golden.counts, integrations_in_use: {} };
		const big = builder.check({ ...golden, counts, features: { ...golden.features }, aggregates: { ...golden.aggregates, payments_minor: Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`A${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26) % 26)}`, i])) } });
		expect(big.ok).toBe(false);
	});

	describe('parseReleaseVersion', () => {
		it.each([
			['v111.47.0', '111.47.0', 'stable'],
			['111.47.0', '111.47.0', 'stable'],
			['v111.32.3-4-gbb20466', '111.32.3', 'dev'],
			['v1.2.3-rc.1', '1.2.3', 'rc'],
			['v1.2.3-beta.2', '1.2.3', 'beta'],
			['v1.2.3-alpha', '1.2.3', 'beta'],
			['1.2.3-acme-corp-prod', '1.2.3', 'custom'],
			['1.2.3+build.5', '1.2.3', 'custom'],
			['', '0.0.0', 'dev'],
			[undefined, '0.0.0', 'dev'],
			['main', '0.0.0', 'dev'],
			['12345.1.1', '0.0.0', 'dev']
		])('%s gives %s on %s, never a suffix', (raw, version, channel) => {
			expect(parseReleaseVersion(raw as string | undefined)).toEqual({ version, channel });
		});
	});
});
