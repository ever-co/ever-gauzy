import { ID, ISearchDocument, ISearchIndexField, ISearchIndexRegistration, JsonData, SearchFieldKind } from '@gauzy/contracts';

/**
 * The key a document's own normalised weight is stored under inside its attribute map.
 *
 * The provider reads it from the same map a filter reads, so the weight travels with the document
 * and a rebuild reproduces it exactly. The value is normalised when the document is written rather
 * than when it is read, which is what makes two entity types comparable: adding a searchable entity
 * cannot reorder the entities that were already indexed, because the numbers it contributes were
 * fixed before it existed.
 */
export const DOCUMENT_WEIGHT_ATTRIBUTE = '_weight';

/**
 * The prefix a promoted token carries for the channel a document belongs to.
 *
 * A document has no channel column — the schema gives it none — so the channel is carried as a
 * promoted token. The token is what makes a channel-scoped search answer with the rows published to
 * that channel instead of with everything in the organization.
 */
export const CHANNEL_TOKEN_PREFIX = 'channelid';

/** One source row, as the indexer read it. */
export type SearchSourceRow = Record<string, any>;

/** Where a document belongs, resolved by the caller from the request context. */
export interface ISearchDocumentScope {
	tenantId?: ID | null;
	organizationId?: ID | null;
	engineKey?: string;
	/** Channel ids the source row is published to, when the declaration names a publication table. */
	channelIds?: ID[];
}

/**
 * Reads a dotted path on a source row.
 *
 * A declaration reads through relations — `translations.name`, `product.translations.name` — because
 * the value a person searches for often lives on a row the entity owns rather than on the entity. A
 * path that meets an array takes the first entry that carries a value, which is what a translation
 * list needs: the document holds one title, and the first translation with one is it.
 *
 * @param row The source row.
 * @param path The dotted path.
 * @returns The first value found, or `undefined`.
 */
export function readPath(row: unknown, path: string): unknown {
	const segments = String(path ?? '')
		.split('.')
		.filter(Boolean);

	return readSegments(row, segments, 0);
}

/**
 * Walks the remaining segments of a path, taking the first entry of an array that carries a value.
 *
 * @param current The value being walked.
 * @param segments The path segments.
 * @param index The segment being read.
 * @returns The first value found, or `undefined`.
 */
function readSegments(current: unknown, segments: string[], index: number): unknown {
	if (current === null || current === undefined) {
		return undefined;
	}

	if (Array.isArray(current)) {
		for (const entry of current) {
			const found = readSegments(entry, segments, index);

			if (found !== undefined && found !== null && found !== '') {
				return found;
			}
		}

		return undefined;
	}

	if (index >= segments.length) {
		return current;
	}

	if (typeof current !== 'object') {
		return undefined;
	}

	return readSegments((current as Record<string, unknown>)[segments[index]], segments, index + 1);
}

/**
 * Renders one value as the text a document holds.
 *
 * A number and a boolean are rendered as themselves rather than dropped: an invoice's total and a
 * variant's enabled flag are things a person types into a search box. A date is rendered as the
 * ISO-8601 string its column carried, which compares chronologically as text and reads the same on
 * every dialect.
 *
 * @param value The value.
 * @returns The text, or an empty string when the value carries none.
 */
export function toSearchText(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (Array.isArray(value)) {
		return value.map((entry) => toSearchText(entry)).filter(Boolean).join(' ');
	}

	if (typeof value === 'object') {
		return '';
	}

	return String(value);
}

/** The separator run a template may join two placeholders with, at the start of some literal text. */
const LEADING_SEPARATOR = /^(?:\s*[—–\-|,;:])+\s*/;

/** The separator run a template may join two placeholders with, at the end of some literal text. */
const TRAILING_SEPARATOR = /\s*(?:[—–\-|,;:]\s*)+$/;

/**
 * Fills a `{{path}}` template from a source row.
 *
 * The templates are how a title reads the way a person would say it — `{{name}} — {{code}}` — without
 * the declaration having to name a single field as *the* title. The punctuation between two
 * placeholders is part of what the declaration asked for and survives whenever both of them carried a
 * value; a separator that stood beside a placeholder whose path carried nothing is removed with it, so
 * a row missing its code does not produce a title that trails a dash.
 *
 * Each separator is therefore judged against the placeholder next to it rather than against the
 * rendered string as a whole: the same dash is kept in one row and dropped in the next, which is the
 * difference between a title a person reads and the joining punctuation of a template.
 *
 * @param template The template.
 * @param row The source row.
 * @returns The rendered title, or an empty string when nothing was filled.
 */
export function renderTemplate(template: string, row: SearchSourceRow): string {
	const source = String(template ?? '');
	/** The literal text and the placeholder values, in the order the template states them. */
	const pieces: Array<{ text: string; placeholder: boolean }> = [];
	let cursor = 0;

	for (const match of source.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
		const at = match.index ?? 0;

		pieces.push({ text: source.slice(cursor, at), placeholder: false });
		pieces.push({ text: toSearchText(readPath(row, match[1])), placeholder: true });
		cursor = at + match[0].length;
	}

	pieces.push({ text: source.slice(cursor), placeholder: false });

	/** Which placeholders rendered nothing, which is what a separator beside them is judged against. */
	const emptied = pieces.map((piece) => piece.placeholder && !piece.text);

	const rendered = pieces.map((piece, index) => {
		if (piece.placeholder) {
			return piece.text;
		}

		let text = piece.text;

		if (emptied[index - 1]) {
			text = text.replace(LEADING_SEPARATOR, ' ');
		}

		if (emptied[index + 1]) {
			text = text.replace(TRAILING_SEPARATOR, ' ');
		}

		return text;
	});

	return tidy(rendered.join(''));
}

/**
 * Collapses the whitespace a template leaves behind.
 *
 * @param text The rendered text.
 * @returns The tidied text.
 */
function tidy(text: string): string {
	return String(text ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * The value a declared field holds on one source row.
 *
 * @param field The declared field.
 * @param row The source row.
 * @returns The value, or `undefined` when the row carries none.
 */
export function fieldValue(field: ISearchIndexField, row: SearchSourceRow): unknown {
	return readPath(row, field.source ?? field.name);
}

/**
 * The document's title.
 *
 * A declaration that states a template gets it. One that does not gets the value of its
 * highest-weighted searchable field, which is the closest thing to a title the declaration contains —
 * and it is chosen from the declaration rather than at random, so the same row always produces the
 * same title.
 *
 * @param definition The declaration.
 * @param row The source row.
 * @returns The title, never longer than the column allows.
 */
export function buildTitle(definition: ISearchIndexRegistration, row: SearchSourceRow): string {
	const templated = definition.titleTemplate ? renderTemplate(definition.titleTemplate, row) : '';

	if (templated) {
		return truncate(templated, 512);
	}

	const fallback = [...(definition.fields ?? [])]
		.filter((field) => field.searchable)
		.sort((left, right) => (right.weight ?? 0) - (left.weight ?? 0))
		.map((field) => toSearchText(fieldValue(field, row)))
		.find(Boolean);

	return truncate(fallback ?? '', 512);
}

/**
 * The document's searchable body.
 *
 * A templated body is what the declaration asked for. Without one, the remaining searchable fields
 * are joined in declaration order — deterministic, and ordered by what the declaration considered
 * most important first, so a truncated body loses the least important text.
 *
 * @param definition The declaration.
 * @param row The source row.
 * @returns The body.
 */
export function buildBody(definition: ISearchIndexRegistration, row: SearchSourceRow): string | undefined {
	const templated = definition.bodyTemplate ? renderTemplate(definition.bodyTemplate, row) : '';

	if (templated) {
		return templated;
	}

	const joined = (definition.fields ?? [])
		.filter((field) => field.searchable)
		.map((field) => toSearchText(fieldValue(field, row)))
		.filter(Boolean)
		.join(' ');

	return joined ? tidy(joined) : undefined;
}

/**
 * The promoted tokens of one document.
 *
 * A promoted token is `name:value`, lower-cased, and it is what gives MySQL and SQLite an
 * index-served filter path where the JSON index does not exist: a filter and a facet both address a
 * field by name, and the name is in the token, so one flat token list serves every field of the
 * declaration.
 *
 * The channel tokens are promoted the same way, from the channel ids the caller resolved. They are
 * what a channel-scoped search matches on, and they are deliberately tokens rather than a column,
 * because the document table has no channel of its own.
 *
 * @param definition The declaration.
 * @param row The source row.
 * @param channelIds The channels the row is published to.
 * @returns The tokens.
 */
export function buildKeywords(
	definition: ISearchIndexRegistration,
	row: SearchSourceRow,
	channelIds: ID[] = []
): string[] {
	const tokens = new Set<string>();

	for (const name of definition.keywordFields ?? []) {
		const field = (definition.fields ?? []).find((candidate) => candidate.name === name);

		if (!field) {
			continue;
		}

		for (const value of flatten(fieldValue(field, row))) {
			tokens.add(`${name.toLowerCase()}:${value.toLowerCase()}`);
		}
	}

	for (const channelId of channelIds ?? []) {
		if (channelId) {
			tokens.add(`${CHANNEL_TOKEN_PREFIX}:${String(channelId).toLowerCase()}`);
		}
	}

	return Array.from(tokens);
}

/**
 * The attribute map of one document.
 *
 * Every declared field whose value the row carries is written, keyed by the field's name — the name a
 * filter and a facet address it by. A number stays a number and a boolean stays a boolean, because a
 * range filter over a price is a numeric comparison and a flag is not the string `"true"`.
 *
 * @param definition The declaration.
 * @param row The source row.
 * @param weight The document's normalised weight.
 * @returns The attribute map.
 */
export function buildAttributes(
	definition: ISearchIndexRegistration,
	row: SearchSourceRow,
	weight: number
): JsonData {
	const attributes: Record<string, unknown> = {};

	for (const field of definition.fields ?? []) {
		const value = fieldValue(field, row);

		if (value === null || value === undefined || value === '') {
			continue;
		}

		if (field.kind === SearchFieldKind.TEXT) {
			const text = toSearchText(value);

			if (text) {
				attributes[field.name] = text;
			}

			continue;
		}

		if (Array.isArray(value)) {
			const values = flatten(value);

			if (values.length > 0) {
				attributes[field.name] = values;
			}

			continue;
		}

		if (value instanceof Date) {
			// A `Date` is an object, and the guard below dropped it — so a declared `DATE` field never
			// reached the attribute map at all and every date filter, sort and facet addressed an
			// attribute that was not there. It is written as the ISO-8601 string the rest of the
			// pipeline is built around: the provider compares dates as text because ISO-8601 text
			// compares chronologically, and `toSearchText` renders a date the same way.
			attributes[field.name] = value.toISOString();

			continue;
		}

		if (typeof value === 'object') {
			continue;
		}

		attributes[field.name] = value;
	}

	attributes[DOCUMENT_WEIGHT_ATTRIBUTE] = weight;

	return attributes as JsonData;
}

/**
 * The document's normalised weight.
 *
 * The weight is the average declared weight of the searchable fields the row actually filled, not
 * their sum. A sum would reward a declaration for listing more fields: a six-field entity would
 * outrank a two-field one carrying exactly the same information, purely because its declaration is
 * longer. The average asks the question that matters — how important is the text this row has? — and
 * answers it with a number that means the same thing on every entity type.
 *
 * A row that filled no searchable field falls back to the declaration's default weight, which is the
 * documented answer for `weight` being absent.
 *
 * @param definition The declaration.
 * @param row The source row.
 * @returns The weight, as a finite non-negative number.
 */
export function normalisedWeight(definition: ISearchIndexRegistration, row: SearchSourceRow): number {
	const weights = (definition.fields ?? [])
		.filter((field) => field.searchable)
		.filter((field) => toSearchText(fieldValue(field, row)).length > 0)
		.map((field) => Number(field.weight))
		.filter((weight) => Number.isFinite(weight) && weight >= 0);

	const fallback = Number(definition.defaultWeight);

	if (weights.length === 0) {
		return Number.isFinite(fallback) && fallback >= 0 ? fallback : 1;
	}

	const average = weights.reduce((total, weight) => total + weight, 0) / weights.length;

	return Number(average.toFixed(6));
}

/**
 * The instant a document was built from.
 *
 * It is what lets an index run skip a source row that has not moved and what identifies a document as
 * stale, so a declaration whose entity has no such column names `updatedAt` and a row that does not
 * carry it produces no timestamp rather than a fabricated one.
 *
 * @param definition The declaration.
 * @param row The source row.
 * @returns The instant, or `undefined`.
 */
export function buildSourceUpdatedAt(
	definition: ISearchIndexRegistration,
	row: SearchSourceRow
): Date | undefined {
	const value = readPath(row, definition.sourceUpdatedAtField || 'updatedAt');

	if (!value) {
		return undefined;
	}

	const date = value instanceof Date ? value : new Date(String(value));

	return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Builds one document from one source row.
 *
 * This is the whole of the pipeline's pure half: the same row and the same declaration always
 * produce the same document, which is what makes the index disposable and a rebuild reproducible.
 * Nothing here reads the request context, the clock or the database — the caller supplies the scope
 * and the channels it resolved, so a rebuild run eight hours later writes byte-identical content.
 *
 * @param definition The declaration.
 * @param row The source row.
 * @param scope Where the document belongs and which engine will hold it.
 * @returns The document.
 * @throws Error when the row carries no identity, because a document without one cannot be keyed.
 */
export function buildDocument(
	definition: ISearchIndexRegistration,
	row: SearchSourceRow,
	scope: ISearchDocumentScope
): ISearchDocument {
	const entityId = row?.id as ID;

	if (!entityId) {
		throw new Error(
			`A "${definition.entity}" row was handed to the indexer without an id, so the document it would ` +
				'produce could not be keyed and would be written again on every run.'
		);
	}

	const weight = normalisedWeight(definition, row);

	return {
		entity: definition.entity,
		entityId,
		tenantId: (scope.tenantId ?? row.tenantId ?? null) as ID,
		organizationId: (scope.organizationId ?? row.organizationId ?? null) as ID,
		title: buildTitle(definition, row),
		body: buildBody(definition, row),
		keywords: buildKeywords(definition, row, scope.channelIds),
		attributes: buildAttributes(definition, row, weight),
		sourceUpdatedAt: buildSourceUpdatedAt(definition, row),
		indexedAt: new Date(),
		engineKey: scope.engineKey,
		definitionVersion: 1
	};
}

/**
 * Flattens one value into the strings it contributes.
 *
 * @param value The value.
 * @returns The strings, without duplicates.
 */
export function flatten(value: unknown): string[] {
	if (value === null || value === undefined) {
		return [];
	}

	if (Array.isArray(value)) {
		return Array.from(new Set(value.flatMap((entry) => flatten(entry)).filter(Boolean)));
	}

	if (typeof value === 'object') {
		return [];
	}

	const text = toSearchText(value);

	return text ? [text] : [];
}

/**
 * Bounds a string to what its column holds.
 *
 * @param value The value.
 * @param max The largest length the column accepts.
 * @returns The value, truncated on a word boundary where one is near the end.
 */
export function truncate(value: string, max: number): string {
	const text = String(value ?? '');

	if (text.length <= max) {
		return text;
	}

	const clipped = text.slice(0, max - 1);
	const boundary = clipped.lastIndexOf(' ');

	return `${(boundary > max * 0.6 ? clipped.slice(0, boundary) : clipped).trim()}…`;
}
