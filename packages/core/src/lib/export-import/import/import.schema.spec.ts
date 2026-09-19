/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema } from 'graphql';
import { ImportController } from './import.controller';

/**
 * The import domain, and the surface it does not have.
 *
 * The delivered route answers an `ImportHistory` ledger row — which this schema does declare, in the
 * domain that owns it — but the value it *needs* is an uploaded archive, and that is not an argument a
 * GraphQL field can state. The suite below holds both halves of that decision in place: that this domain
 * contributes no root field of its own, and that the ledger row it answers is declared exactly once, by
 * the domain that owns the entity rather than restated here.
 */

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

describe('ImportController — the route the absence of a surface rests on', () => {
	it('serves one route, and it takes an uploaded archive rather than a body', () => {
		const handlers = ImportController.prototype as unknown as Record<string, unknown>;

		expect(typeof handlers['parse']).toBe('function');

		// The decision is about the argument's shape, so it is tied to the route itself: the handler reads
		// the stored file the interceptor wrote — its key, its name and its size — and never a document
		// from the request body. A handler that accepted a path or a payload instead would be a different
		// capability and this document would be wrong rather than merely stale.
		const source = readFileSync(join(__dirname, 'import.controller.ts'), 'utf8');
		expect(source).toContain('@UploadedFileStorage()');
		expect(source).toContain('FileInterceptor');
		expect(source).toContain('archiveUploadFileFilter');
	});

	it('answers a ledger row, through the command the ledger domain owns', () => {
		const source = readFileSync(join(__dirname, 'import.controller.ts'), 'utf8');

		// The delivered answer is the import-history row, on success and on failure alike.
		expect(source).toContain('ImportHistoryCreateCommand');
		expect(source).toContain('ImportStatusEnum.SUCCESS');
		expect(source).toContain('ImportStatusEnum.FAILED');
	});
});

describe('ImportController — the composed schema carries no field of this domain', () => {
	it('contributes no query and no mutation of its own', () => {
		for (const operation of ['Query', 'Mutation'] as const) {
			// `importHistories` is the ledger connection, declared by the domain that owns the entity; this
			// domain contributes nothing beside it.
			expect(
				rootFields(operation).filter(
					(field) => field.toLowerCase().startsWith('import') && field !== 'importHistories'
				)
			).toEqual([]);
		}
	});

	it('declares no type of its own, because the row it answers has an owner', () => {
		expect(isCommentOnly(document('import.type.gql'))).toBe(true);
		expect(isCommentOnly(document('import.api.gql'))).toBe(true);
	});

	it('names the domain that declares the ledger row rather than restating it', () => {
		const type = document('import.type.gql');

		expect(type).toContain('ImportHistory');
		expect(type).toContain('import-history');
		// The row is declared once in the whole schema, and by that domain.
		expect(schema.getType('ImportHistory')).toBeDefined();
	});
});
