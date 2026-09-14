import { isFunction, isNotEmpty } from '@gauzy/utils';
import { maskSecret } from '../core/decorators/is-secret';

/**
 * Reflect metadata key carrying the per-class list of "mask this column in an export archive" marks.
 */
export const EXPORT_REDACT_METADATA = 'exportRedact';

/**
 * How a marked column is treated when a row is written into an export archive.
 */
export interface IExportRedactOptions<T = any> {
	/**
	 * Decides, for a single row, whether this column's value is a secret.
	 *
	 * Omit it when the column is ALWAYS a secret (a password, a bearer token). Supply it for the
	 * key/value tables where one column holds both credentials and harmless flags —
	 * `integration_setting.settingsValue`, `tenant_setting.value`.
	 *
	 * 🛑 Fail closed: the value is redacted unless the predicate returns **exactly `false`**. A
	 * predicate that throws, or that cannot decide and returns `undefined`, therefore masks — a
	 * check that cannot reach a verdict must not return the permissive one.
	 */
	when?: (entity: T) => boolean;

	/**
	 * Write an empty value instead of a masked one.
	 *
	 * {@link maskSecret} leaves a short trailing hint on long values so an operator can tell two
	 * credentials apart. That hint is worth nothing for a stored *digest* (a bcrypt hash, a hashed
	 * refresh token), where it only ever gives an attacker free characters, so those blank instead.
	 */
	blank?: boolean;
}

/** A single mark, as stored in metadata. */
interface IExportRedactMark<T = any> extends IExportRedactOptions<T> {
	property: string;
}

/**
 * Marks an entity column as **redacted on export**: present in the archive, never in cleartext.
 *
 * ## Why this exists
 *
 * Two serialization paths leave this application, and they do not share a masking mechanism. The
 * JSON API path runs `instanceToPlain` through `TransformInterceptor`, so `@Exclude({ toPlainOnly:
 * true })` and the `@Expose`d `wrapSecret*` mirrors hide credentials there. The CSV export path
 * (`ExportService.csvWriter`) hands raw entity objects to `csv-writer`, which reads
 * `object[property]` directly and knows nothing about class-transformer — so every one of those
 * protections is bypassed and OAuth tokens, API keys, SMTP passwords and object-storage secret keys
 * were written to the archive verbatim (GHSA-j5h5-r956-rxc3).
 *
 * This marker is the declarative seam for the export path, the sibling of `@SkipExport()`, which
 * does the same job one level up (a whole entity rather than one column). Marking the column at its
 * declaration is the point: a hand-maintained list of secret columns inside the export service
 * cannot see a plugin's entities and goes stale the first time somebody adds a column.
 *
 * The column itself is kept in the archive with a masked value rather than dropped, so the CSV
 * header stays stable and a round-trip import still sees the table's shape.
 *
 * @example
 * ```ts
 * // always a secret
 * @ExportRedacted()
 * @MultiORMColumn()
 * password: string;
 *
 * // a secret unless the row's name says otherwise
 * @ExportRedacted<IntegrationSetting>({ when: (it) => !nonSecretSettingKeys.includes(it.settingsName) })
 * @MultiORMColumn()
 * settingsValue: string;
 * ```
 *
 * @see exportRedacted for the imperative form.
 */
export function ExportRedacted<T = any>(options: IExportRedactOptions<T> = {}): PropertyDecorator {
	return (target: object, propertyKey: string | symbol) => {
		if (typeof propertyKey !== 'string') {
			return;
		}
		// Property decorators on instance members receive the PROTOTYPE; the marks belong to the class.
		defineExportRedactMark(target.constructor, propertyKey, options);
	};
}

/**
 * Imperative equivalent of {@link ExportRedacted} — marks a column from outside the entity's file.
 *
 * Useful where the entity class cannot be decorated in place (a third-party class, or a plugin that
 * registers entities it does not own), mirroring `skipExport()`.
 *
 * @param entity - The entity class owning the column.
 * @param property - The property name to redact.
 * @param options - Redaction options, see {@link IExportRedactOptions}.
 */
export function exportRedacted<T = any>(
	entity: Function,
	property: string,
	options: IExportRedactOptions<T> = {}
): void {
	if (isFunction(entity) && typeof property === 'string' && property) {
		defineExportRedactMark(entity, property, options);
	}
}

/**
 * Stores (or replaces) one mark in the entity class's OWN metadata.
 */
function defineExportRedactMark(entity: Function, property: string, options: IExportRedactOptions): void {
	const own: IExportRedactMark[] = Reflect.getOwnMetadata(EXPORT_REDACT_METADATA, entity) ?? [];
	const marks = [...own.filter((mark) => mark.property !== property), { ...options, property }];
	Reflect.defineMetadata(EXPORT_REDACT_METADATA, marks, entity);
}

/**
 * Every redaction mark that applies to an entity class, including the ones it inherits.
 *
 * 🛑 Inheritance is deliberate here, and it is the OPPOSITE call from `isExportSkipped()`, which
 * reads own-metadata only. Inheriting a *skip* would silently drop a subclass's rows out of the
 * archive — quiet data loss. Inheriting a *redaction* only ever masks more: a subclass of an entity
 * with a credential column has that same column, so it needs the same mask. The safe default for
 * each marker is the one that cannot be wrong in the dangerous direction.
 *
 * A mark declared on the subclass wins over the base class's mark for the same property.
 *
 * @param entity - The entity class to inspect.
 * @returns The marks keyed by property name; empty when the entity carries none.
 */
export function getExportRedactedProperties(entity: Function): Map<string, IExportRedactOptions> {
	const marks = new Map<string, IExportRedactOptions>();

	if (!isFunction(entity)) {
		return marks;
	}

	// Walk the constructor chain base-first so a subclass's mark overwrites the base's.
	const chain: Function[] = [];
	for (let cursor: any = entity; isFunction(cursor); cursor = Object.getPrototypeOf(cursor)) {
		chain.unshift(cursor);
	}

	for (const ancestor of chain) {
		const own: IExportRedactMark[] = Reflect.getOwnMetadata(EXPORT_REDACT_METADATA, ancestor) ?? [];
		for (const { property, ...options } of own) {
			marks.set(property, options);
		}
	}

	return marks;
}

/**
 * Whether a value is a secret for this row, according to the mark.
 *
 * Fail closed in every direction that is not an explicit "no": a predicate that throws, or returns
 * anything other than `false`, means "treat it as a secret".
 */
function isSecretValue(mark: IExportRedactOptions, row: unknown): boolean {
	if (!mark.when) {
		return true;
	}
	try {
		return mark.when(row) !== false;
	} catch {
		return true;
	}
}

/**
 * Projects one entity row onto the plain object that is written into an export CSV.
 *
 * Two things happen here, and both are security-relevant:
 *
 * 1. **Marked columns are masked.** See {@link ExportRedacted}.
 * 2. **Anything that is not a persisted column is dropped** when `columns` is supplied. Entity
 *    instances carry more than their columns by the time they reach the writer: TypeORM subscribers
 *    attach derived properties (`IntegrationSettingSubscriber` adds `wrapSecretValue`), and
 *    `@VirtualMultiOrmColumn` properties are computed rather than stored. None of it belongs in an
 *    archive whose purpose is to round-trip the tables, and each one is a way for a future
 *    subscriber to put a cleartext credential back into the CSV behind the column marks' back.
 *
 * @param entity - The entity class the row belongs to. Required: without it there is no way to know
 *                 which columns are secret, and guessing would be the permissive answer. Throws.
 * @param row - The hydrated entity (or any plain row object) to project.
 * @param columns - Property names of the persisted columns. Omit to keep every own property.
 * @returns A plain object safe to hand to `csv-writer`.
 */
export function redactForExport(entity: Function, row: object, columns?: Iterable<string>): Record<string, unknown> {
	if (!isFunction(entity)) {
		// Fail closed: an unknown entity class means unknown secrets, so refuse to write the row
		// rather than write it in cleartext.
		throw new TypeError('redactForExport() requires the entity class the row belongs to');
	}

	const marks = getExportRedactedProperties(entity);
	const allowed = columns ? new Set(columns) : null;
	const redacted: Record<string, unknown> = {};

	for (const property of Object.keys(row)) {
		if (allowed && !allowed.has(property)) {
			continue;
		}

		const value = (row as Record<string, unknown>)[property];
		const mark = marks.get(property);

		// `isNotEmpty` keeps null/undefined/'' as they are: masking an absent value would invent a
		// non-null one and make an empty column look populated.
		if (mark && isNotEmpty(value) && isSecretValue(mark, row)) {
			redacted[property] = mark.blank ? '' : maskSecret(value);
			continue;
		}

		redacted[property] = value;
	}

	return redacted;
}
