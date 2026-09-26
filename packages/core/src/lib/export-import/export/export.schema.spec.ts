/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema } from 'graphql';
import { ExportController } from './export.controller';

/**
 * The export domain, and the surface it does not have.
 *
 * Every other domain in this library contributes root fields to the one composed schema. This one
 * contributes none, and the absence is a decision rather than an omission: each of its three routes
 * answers a streamed archive, which is not a value a field can return. The suite below holds that
 * decision in place — a root field appearing here without the documents changing would fail it — and
 * checks that the reason is written down beside the SDL, where whoever adds one will read it.
 */

/** The routes the delivered controller serves, as the decision above depends on them. */
const ROUTES = ['exportAll', 'downloadTemplate', 'exportByName'];

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs. The domain sits two levels below the library root, so the walk starts there.
 */
function composedSchema(): string {
	const root = join(__dirname, '..', '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** One of the domain's own SDL documents, as text. */
function document(name: string): string {
	return readFileSync(join(__dirname, 'schema', name), 'utf8');
}

/** Whether a document declares nothing at all: every line it holds is a comment. */
function isCommentOnly(sdl: string): boolean {
	return sdl
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.every((line) => line.startsWith('#'));
}

describe('ExportController — the routes the absence of a surface rests on', () => {
	it('serves three routes, and every one of them writes a file to the response', () => {
		const handlers = ExportController.prototype as unknown as Record<string, unknown>;

		for (const handler of ROUTES) {
			expect(typeof handlers[handler]).toBe('function');
		}

		// The decision is about the answer's shape, so it is tied to the routes themselves: each handler
		// takes the response object and hands it to the service, which streams an archive into it. A
		// handler that returned a value instead would be a different capability and this document would be
		// wrong rather than merely stale.
		const source = readFileSync(join(__dirname, 'export.controller.ts'), 'utf8');
		expect(source.match(/@Res\(\)/g) ?? []).toHaveLength(ROUTES.length);
		// Each handler streams through the service rather than answering a value, once per route; the job
		// it hands over names the archive being written. Counted rather than merely contained, so a
		// handler that stopped streaming — and answered something a field could declare — fails here.
		expect(source.match(/downloadToUser\(job, res\)/g) ?? []).toHaveLength(ROUTES.length);
	});
});

describe('ExportController — the composed schema carries no field of this domain', () => {
	it('contributes no query and no mutation', () => {
		for (const operation of ['Query', 'Mutation'] as const) {
			expect(rootFields(operation).filter((field) => field.toLowerCase().startsWith('export'))).toEqual([]);
		}
	});

	it('contributes no document at all, which is what keeps the domain out of the composition', () => {
		// Not "a document that declares nothing": the parser refuses a file with no definition
		// ("Unexpected <EOF>") and the boot composes every `*.gql` under a `schema/` directory, so a
		// comment-only document here would break the boot rather than satisfy this suite. The domain
		// ships none, and the absence is itself the statement.
		expect(readdirSync(join(__dirname, 'schema')).filter((name) => name.endsWith('.gql'))).toEqual([]);
	});

	it('writes the reason down where the next reader will find it', () => {
		const api = document('export.api.md');
		const type = document('export.type.md');

		// Documentation, and the file's own header says so: not every line is a GraphQL comment, which is
		// the property that keeps it out of the composition and the reason the extension is not `.gql`.
		expect(isCommentOnly(api)).toBe(false);
		expect(api).toContain('not SDL');

		// The document states what each route answers, and why a streamed archive is not a field.
		expect(api).toContain('GET /');
		expect(api).toContain('GET /template');
		expect(api).toContain('GET /filter');
		expect(api).toContain('download');

		// The two documents name each other, so a reader who opens either one finds the other.
		expect(api).toContain('export.type.md');
		expect(type).toContain('export.api.md');
	});
});
