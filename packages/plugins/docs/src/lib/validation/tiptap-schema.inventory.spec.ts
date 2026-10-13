import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateTiptapDocument } from './tiptap-schema.validator';

/**
 * The server half of the editor ↔ validator contract.
 *
 * `docs-ui`'s `editor-schema-inventory.spec.ts` pins `editor-schema.inventory.json` to what the live
 * editor's `getJSON()` can emit — every node and mark type and the attribute keys each serialises.
 * This suite feeds each of them to `validateTiptapDocument` with every attribute present (as `null`,
 * which no value check rejects), so an attribute the editor writes and this package does not list
 * fails HERE, in CI, instead of as a 400 on a user's autosave. It is read as a file, not imported:
 * the backend must never depend on the Angular editor package — which is also why this project's
 * `test` target lists the JSON among its Nx `inputs` (a changed inventory must re-run this suite).
 *
 * Both entries this suite was written for were real outages of the content route after the
 * TipTap 3.31 upgrade: headings (`id`/`data-toc-id`, the table-of-contents anchor) and table cells
 * (`align`).
 */
const inventoryPath = join(__dirname, '../../../../docs-ui/src/lib/editor/extensions/editor-schema.inventory.json');
const inventory: { nodes: Record<string, string[]>; marks: Record<string, string[]> } = JSON.parse(
	readFileSync(inventoryPath, 'utf8')
);

const withNullAttributes = (keys: string[]) => Object.fromEntries(keys.map((key) => [key, null]));

describe('editor schema inventory → server validator', () => {
	it('reads a non-empty inventory', () => {
		expect(Object.keys(inventory.nodes).length).toBeGreaterThan(20);
		expect(Object.keys(inventory.marks).length).toBeGreaterThan(5);
	});

	it.each(Object.entries(inventory.nodes).filter(([type]) => type !== 'doc'))(
		'accepts a %s node carrying every attribute the editor serialises',
		(type: string, keys: string[]) => {
			const node =
				type === 'text'
					? { type, text: 'x' }
					: { type, ...(keys.length ? { attrs: withNullAttributes(keys) } : {}), content: [] };
			expect(() => validateTiptapDocument({ type: 'doc', attrs: withNullAttributes(inventory.nodes['doc']), content: [node] })).not.toThrow();
		}
	);

	it.each(Object.entries(inventory.marks))(
		'accepts a %s mark carrying every attribute the editor serialises',
		(type: string, keys: string[]) => {
			const mark = { type, ...(keys.length ? { attrs: withNullAttributes(keys) } : {}) };
			expect(() =>
				validateTiptapDocument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [mark] }] }] })
			).not.toThrow();
		}
	);
});
