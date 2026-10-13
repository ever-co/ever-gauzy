import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injector } from '@angular/core';
import { getSchema } from '@tiptap/core';
import { TranslateService } from '@ngx-translate/core';
import { createDocumentEditorExtensions, IDocumentEditorExtensionDeps } from './document-extensions';
import inventory from './editor-schema.inventory.json';

// `lowlight` ships ESM only and only feeds CodeBlockLowlight's highlighting plugin, which the
// schema never reaches — the node type (and its `language` attribute) come from the extension.
jest.mock('lowlight', () => ({
	createLowlight: () => ({
		register: () => undefined,
		registered: () => false,
		listLanguages: () => [],
		highlight: () => ({ type: 'root', children: [] }),
		highlightAuto: () => ({ type: 'root', children: [] })
	})
}));

/**
 * The persisted shape of the live editor: every node and mark type `editor.getJSON()` can emit and
 * the attribute keys it serialises for each.
 *
 * The server validates every autosave against a hand-kept mirror of this (`plugin-docs`'
 * `tiptap-schema.validator.ts`, which may not import the Angular editor) and answers 400 to an
 * attribute it does not list. That mirror drifted once already: `@tiptap/extension-table-of-contents`
 * stamps `id` + `data-toc-id` on every heading, the mirror did not list them, and every page with a
 * heading failed to save ("Save failed · Retry"). The inventory below is the contract between the
 * two packages — this suite fails when the editor's schema moves (a TipTap upgrade, a new extension)
 * and `tiptap-schema.inventory.spec.ts` in `plugin-docs` fails when the server stops accepting any
 * of it. Update the JSON and the server allow-list in the same change.
 */
const describeSchema = (deps: IDocumentEditorExtensionDeps) => {
	const schema = getSchema(createDocumentEditorExtensions(deps));
	const attrsOf = (spec: { attrs?: Record<string, unknown> | null }) => Object.keys(spec.attrs ?? {}).sort();
	const nodes: Record<string, string[]> = {};
	const marks: Record<string, string[]> = {};
	for (const [name, type] of Object.entries(schema.nodes)) nodes[name] = attrsOf(type.spec);
	for (const [name, type] of Object.entries(schema.marks)) marks[name] = attrsOf(type.spec);
	return { nodes, marks };
};

describe('live editor schema inventory', () => {
	const deps = {
		// The mention suggestions resolve their services eagerly; building the schema never calls them.
		injector: { get: () => ({}) } as unknown as Injector,
		translate: { instant: (key: string) => key } as unknown as TranslateService,
		suggestionHost: {},
		uploadService: {},
		slashCommandDeps: {},
		onTocUpdate: () => undefined
	} as unknown as IDocumentEditorExtensionDeps;

	it('matches editor-schema.inventory.json (update it and the plugin-docs validator together)', () => {
		const actual = describeSchema(deps);
		const sortKeys = (record: Record<string, string[]>) =>
			Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
		// Regenerate after a deliberate schema change: DOCS_WRITE_SCHEMA_INVENTORY=1 yarn nx test docs-ui
		if (process.env['DOCS_WRITE_SCHEMA_INVENTORY'] === '1') {
			const json = { nodes: sortKeys(actual.nodes), marks: sortKeys(actual.marks) };
			writeFileSync(join(__dirname, 'editor-schema.inventory.json'), JSON.stringify(json, null, '\t') + '\n');
			return;
		}
		expect({ nodes: sortKeys(actual.nodes), marks: sortKeys(actual.marks) }).toEqual({
			nodes: sortKeys(inventory.nodes),
			marks: sortKeys(inventory.marks)
		});
	});

	it('records the table-of-contents anchor on headings', () => {
		expect(inventory.nodes.heading).toEqual(expect.arrayContaining(['id', 'data-toc-id']));
	});
});
