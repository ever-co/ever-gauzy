import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Regression guard for an outage this repository has now actually had.
 *
 * `@Plugin({ entities })` in `docs.plugin.ts` is what MikroORM uses to discover entity metadata.
 * That array was hand-written and duplicated `ALL_DOC_ENTITIES`; when `DocumentInboundAddress` was
 * added to `ALL_DOC_ENTITIES` and to both ORM `forFeature` arrays but not to the plugin's copy,
 * TypeScript still compiled, every unit test still passed, and the API then crash-looped at boot
 * with `MetadataError: Metadata for entity DocumentInboundAddress not found`.
 *
 * Nothing in the type system connects those two lists, so the only thing that can connect them is
 * a test. This one asserts the plugin spreads the single source rather than restating it.
 *
 * Source-level by necessity: importing `docs.plugin.ts` pulls in the entities, and an entity pulls
 * in its MikroORM repository, whose base class is undefined under jest — the same pre-existing
 * limitation that keeps every other spec in this package away from entity imports.
 */
describe('DocsPlugin entity registration', () => {
	const pluginSource = readFileSync(join(__dirname, '..', 'docs.plugin.ts'), 'utf8');
	const entitiesSource = readFileSync(join(__dirname, 'index.ts'), 'utf8');

	it('registers entities by spreading ALL_DOC_ENTITIES, not a hand-written list', () => {
		// Tolerates whitespace/formatting, but not a literal array of entity names.
		expect(pluginSource).toMatch(/entities:\s*\[\s*\.\.\.ALL_DOC_ENTITIES\s*,?\s*\]/);
	});

	it('does not restate individual entity names in the @Plugin entities array', () => {
		const match = /entities:\s*\[([^\]]*)\]/.exec(pluginSource);
		expect(match).not.toBeNull();
		// A drifting copy always looks like `entities: [Document, DocumentCategory, ...]`.
		expect(match?.[1]).not.toMatch(/\bDocument[A-Za-z]*\s*,/);
	});

	it('keeps every entity exported from the barrel inside ALL_DOC_ENTITIES', () => {
		// Every `export { X } from './x.entity'` must appear in the array, or it exists as a type
		// but is invisible to the ORM — the exact shape of the outage above.
		const exported = [...entitiesSource.matchAll(/export \{ (\w+) \} from '\.\/[\w-]+\.entity';/g)].map(
			(m) => m[1]
		);
		const arrayBody = entitiesSource.slice(entitiesSource.indexOf('ALL_DOC_ENTITIES'));
		const registered = arrayBody.slice(arrayBody.indexOf('['), arrayBody.indexOf(']'));

		expect(exported.length).toBeGreaterThan(0);
		for (const name of exported) {
			expect(registered).toContain(name);
		}
	});
});
