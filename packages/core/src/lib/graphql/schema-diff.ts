/**
 * Classifies what changed between two versions of the GraphQL schema, and finds a deprecated
 * element that was removed before the release its deprecation promised.
 *
 * The two inputs are always `printSchema` output — the committed snapshot and the snapshot at the
 * revision a pull request targets. That is what makes this module readable without the GraphQL
 * runtime: `printSchema` is canonical by construction (one declaration per line, two-space
 * indentation, descriptions in block strings), so the comparison reads a known shape rather than
 * parsing arbitrary SDL. A document that does not have that shape is reported, not guessed at
 * (`validateSchemaSnapshot`), because a silent mis-read here would classify a removal as a rename.
 *
 * The classification is the one a client experiences:
 *
 * - anything that can make a query or mutation that used to work stop working, or start failing
 *   validation, is `BREAKING` — a removed type, field, argument or enum value, a changed type, a
 *   tightened nullability, a newly required argument or input field;
 * - anything a client cannot notice, or can only benefit from, is `ADDITIVE` — a new type, field,
 *   optional argument, enum value or union member, a relaxed nullability, a new deprecation.
 *
 * A nullability RELAXATION is `ADDITIVE` on purpose: a field that used to be non-null becoming
 * nullable cannot break a client that already handled the non-null case, though it is worth
 * announcing, and the change list says so.
 */

/** How a change affects a caller. */
export type SchemaChangeClassification = 'ADDITIVE' | 'BREAKING';

/** What changed. One value per row of the classification table, so a report reads as a list. */
export type SchemaChangeKind =
	| 'TYPE_ADDED'
	| 'TYPE_REMOVED'
	| 'TYPE_KIND_CHANGED'
	| 'FIELD_ADDED'
	| 'FIELD_REMOVED'
	| 'FIELD_TYPE_CHANGED'
	| 'FIELD_NULLABILITY_TIGHTENED'
	| 'FIELD_NULLABILITY_RELAXED'
	| 'ARGUMENT_ADDED'
	| 'ARGUMENT_REMOVED'
	| 'ARGUMENT_TYPE_CHANGED'
	| 'INPUT_FIELD_ADDED'
	| 'INPUT_FIELD_REMOVED'
	| 'INPUT_FIELD_TYPE_CHANGED'
	| 'ENUM_VALUE_ADDED'
	| 'ENUM_VALUE_REMOVED'
	| 'UNION_MEMBER_ADDED'
	| 'UNION_MEMBER_REMOVED'
	| 'DEPRECATION_ADDED'
	| 'DEPRECATION_REMOVED';

/**
 * What a `@deprecated` marker says. The convention is
 * `@deprecated(reason: "<replacement>; removal planned for <release>")`, which is what makes a
 * removal checkable: the replacement tells a client what to move to, and the release tells the
 * gate when the element may go.
 */
export interface DeprecationNotice {
	/** The full reason text, or the specification's default for a bare `@deprecated`. */
	readonly reason?: string;
	/** The text before the first `;` — the replacement a client should move to. */
	readonly replacement?: string;
	/** The release named by `removal planned for <release>`, when one is named. */
	readonly removalRelease?: string;
}

/** A field of an object, interface or input type, an argument of a field, or an enum value. */
export interface SchemaFieldModel {
	readonly name: string;
	/** The written type, nullability included: `[Role!]!`. Empty for an enum value. */
	readonly type: string;
	/** Arguments, for object and interface fields. Empty everywhere else. */
	readonly arguments: readonly SchemaFieldModel[];
	/** True when a caller must supply it: non-null and with no default. */
	readonly required: boolean;
	readonly deprecation?: DeprecationNotice;
}

/** One type of the document. */
export interface SchemaTypeModel {
	readonly name: string;
	readonly kind: 'type' | 'input' | 'interface' | 'enum' | 'union' | 'scalar';
	/** Fields, input fields or enum values, keyed by name. */
	readonly fields: ReadonlyMap<string, SchemaFieldModel>;
	/** Union members, in declaration order. */
	readonly members: readonly string[];
}

/** A read of a snapshot: the types it declares, and anything that did not read cleanly. */
export interface SchemaDocumentModel {
	readonly types: ReadonlyMap<string, SchemaTypeModel>;
	/** Lines the reader did not recognise, or declarations that cannot be trusted. */
	readonly problems: readonly string[];
}

/** One change between two snapshots. */
export interface SchemaChange {
	readonly kind: SchemaChangeKind;
	readonly classification: SchemaChangeClassification;
	/** The element's path: `Role`, `Role.name`, `Query.roles(first:)`. */
	readonly path: string;
	/** A sentence for the CI log, written so a reviewer can decide without opening the snapshot. */
	readonly detail: string;
}

/** The whole diff. `kind` is `BREAKING` when any single change is. */
export interface SchemaDiff {
	readonly kind: SchemaChangeClassification;
	readonly changes: readonly SchemaChange[];
}

/** A deprecated element a change removes while its declared window is still open. */
export interface EarlyDeprecationRemoval {
	readonly path: string;
	readonly deprecation: DeprecationNotice;
	/** Why the removal is refused, phrased for the person who has to fix it. */
	readonly refusal: string;
}

const DEFAULT_DEPRECATION_REASON = 'No longer supported';

/** How the three nullability rows of the classification table are named per element kind. */
interface TypeChangeKinds {
	readonly changed: SchemaChangeKind;
	readonly tightened: SchemaChangeKind;
	readonly relaxed: SchemaChangeKind;
}

const FIELD_TYPE_KINDS: TypeChangeKinds = {
	changed: 'FIELD_TYPE_CHANGED',
	tightened: 'FIELD_NULLABILITY_TIGHTENED',
	relaxed: 'FIELD_NULLABILITY_RELAXED'
};

/**
 * Reads a `printSchema` document.
 *
 * @param sdl - The snapshot text.
 */
export function readSchemaDocument(sdl: string): SchemaDocumentModel {
	const types = new Map<string, SchemaTypeModel>();
	const problems: string[] = [];
	const stripped = stripDescriptions(sdl);
	if (stripped.unterminated) {
		problems.push('a description block was never closed.');
	}

	/** The block being read, or the root-operation block, which declares nothing to classify. */
	let open:
		| { kind: SchemaTypeModel['kind'] | 'schema'; name: string; fields: Map<string, SchemaFieldModel>; members: string[] }
		| undefined;

	for (const statement of splitDeclarations(stripped.text)) {
		const at = `line ${statement.line}`;
		const line = statement.text;

		if (line === '}') {
			if (!open) {
				problems.push(`${at}: a closing brace with no open block.`);
				continue;
			}
			if (open.kind !== 'schema') {
				types.set(open.name, { name: open.name, kind: open.kind, fields: open.fields, members: open.members });
			}
			open = undefined;
			continue;
		}

		if (!open) {
			const header = /^(type|input|interface|enum|union|scalar)\s+([_A-Za-z][_0-9A-Za-z]*)\s*(.*)$/.exec(line);
			if (header) {
				const [, keyword, name, rest] = header;
				if (types.has(name)) problems.push(`${at}: '${name}' is declared more than once.`);
				if (keyword === 'union') {
					const members = rest
						.replace(/^=\s*/, '')
						.split('|')
						.map((member) => member.trim())
						.filter(Boolean);
					if (!members.length) problems.push(`${at}: the union '${name}' declares no members.`);
					types.set(name, { name, kind: 'union', fields: new Map(), members });
					continue;
				}
				if (keyword === 'scalar') {
					types.set(name, { name, kind: 'scalar', fields: new Map(), members: [] });
					continue;
				}
				if (!rest.includes('{')) {
					problems.push(`${at}: '${name}' is declared without a body.`);
					continue;
				}
				open = { kind: keyword as SchemaTypeModel['kind'], name, fields: new Map(), members: [] };
				continue;
			}

			if (/^schema\s*\{/.test(line) || line === 'schema') {
				open = { kind: 'schema', name: 'schema', fields: new Map(), members: [] };
				continue;
			}

			// Directive definitions are deliberately not classified: a directive declaration is not
			// part of the query contract a client compiles against.
			if (/^directive\s+@/.test(line)) continue;

			problems.push(`${at}: '${line}' is not a declaration this reader understands.`);
			continue;
		}

		if (open.kind === 'schema') continue;

		const mode = open.kind === 'enum' ? 'enum' : open.kind === 'input' ? 'input' : 'field';
		const field = readField(line, mode);
		if (!field) {
			problems.push(`${at}: '${line}' is not a ${mode === 'enum' ? 'value' : 'field'} of '${open.name}'.`);
			continue;
		}
		if (open.fields.has(field.name)) problems.push(`${at}: '${open.name}.${field.name}' is declared more than once.`);
		open.fields.set(field.name, field);
	}

	if (open) problems.push(`the block for '${open.name}' was never closed.`);

	return { types, problems };
}

/** One declaration, and the line it started on. */
interface Declaration {
	readonly text: string;
	readonly line: number;
}

/**
 * Splits the document into declarations.
 *
 * Descriptions are removed first, because they are documentation rather than contract and they are
 * what makes a declaration span lines: `printSchema` prints a field's arguments across several
 * lines whenever any of them carries a description, and keeps them on one line when none does. A
 * continuation line is joined to the declaration it belongs to, so both forms read identically.
 *
 * @param sdl - The snapshot text, descriptions already removed.
 */
function splitDeclarations(sdl: string): Declaration[] {
	const declarations: Declaration[] = [];
	let current = '';
	let line = 1;
	let startLine = 1;
	let depth = 0;

	for (let index = 0; index < sdl.length; index += 1) {
		const character = sdl[index];

		if (character === '\n') {
			line += 1;
			if (depth === 0) {
				if (current.trim()) declarations.push({ text: current.trim(), line: startLine });
				current = '';
				startLine = line;
			} else {
				current += ' ';
			}
			continue;
		}

		if (character === '(' || character === '[') depth += 1;
		if (character === ')' || character === ']') depth = Math.max(0, depth - 1);

		if (character === '{' && depth === 0) {
			declarations.push({ text: `${current} {`.trim(), line: startLine });
			current = '';
			startLine = line;
			continue;
		}

		if (character === '}' && depth === 0) {
			if (current.trim()) declarations.push({ text: current.trim(), line: startLine });
			declarations.push({ text: '}', line });
			current = '';
			startLine = line;
			continue;
		}

		if (!current.trim()) startLine = line;
		current += character;
	}

	if (current.trim()) declarations.push({ text: current.trim(), line: startLine });

	return declarations;
}

/**
 * Removes every description, and reports one that was never closed.
 *
 * A description never carries meaning for the classification — it is not a type, a field, an
 * argument or a nullability — so removing it up front cannot hide a change. An UNTERMINATED one is
 * reported, because it would otherwise swallow the declarations after it and make a removal look
 * like a rename.
 *
 * @param sdl - The snapshot text.
 */
function stripDescriptions(sdl: string): { text: string; unterminated: boolean } {
	let text = '';
	let index = 0;
	let unterminated = false;

	while (index < sdl.length) {
		const opening = sdl.indexOf('"""', index);
		if (opening < 0) {
			text += sdl.slice(index);
			break;
		}

		text += sdl.slice(index, opening);

		let cursor = opening + 3;
		for (;;) {
			const closing = sdl.indexOf('"""', cursor);
			if (closing < 0) {
				unterminated = true;
				cursor = sdl.length;
				break;
			}
			// A triple quote inside a description is escaped, and does not close it.
			if (sdl[closing - 1] === '\\') {
				cursor = closing + 3;
				continue;
			}
			cursor = closing + 3;
			break;
		}

		index = cursor;
		// The newline is kept so the declarations before and after stay separate.
		text += '\n';
	}

	return { text, unterminated };
}

/**
 * Reports why a snapshot cannot be trusted, so the gate fails before it compares anything.
 *
 * @param sdl - The snapshot text.
 */
export function validateSchemaSnapshot(sdl: string): readonly string[] {
	if (!sdl.trim()) {
		return ['the schema snapshot is empty.'];
	}

	const document = readSchemaDocument(sdl);
	const problems: string[] = [...document.problems];

	if (!document.types.get('Query')) {
		problems.push("the snapshot declares no 'Query' type, so it is not a schema.");
	}

	// An undated deprecation is not a style problem: it names an element the gate can never allow
	// to be removed, and the person who wrote it is the only one who knows when it may go.
	for (const [name, type] of document.types) {
		for (const field of type.fields.values()) {
			for (const element of [field, ...field.arguments]) {
				if (element.deprecation && !element.deprecation.reason) {
					problems.push(
						`'${name}.${element.name}' is deprecated without a reason; write ` +
							'`@deprecated(reason: "<replacement>; removal planned for <release>")`.'
					);
				}
			}
		}
	}

	return problems;
}

/**
 * Classifies every change between two snapshots.
 *
 * @param previous - The snapshot at the target revision.
 * @param next - The snapshot being proposed.
 */
export function classifySchemaDiff(previous: string, next: string): SchemaDiff {
	const before = readSchemaDocument(previous);
	const after = readSchemaDocument(next);
	const changes: SchemaChange[] = [];

	for (const [name, previousType] of before.types) {
		const nextType = after.types.get(name);
		if (!nextType) {
			changes.push(breaking('TYPE_REMOVED', name, `The type '${name}' was removed.`));
			continue;
		}
		if (nextType.kind !== previousType.kind) {
			changes.push(
				breaking('TYPE_KIND_CHANGED', name, `'${name}' changed from a ${previousType.kind} to a ${nextType.kind}.`)
			);
			continue;
		}

		changes.push(...classifyTypeMembers(name, previousType, nextType));
	}

	for (const [name, nextType] of after.types) {
		if (!before.types.has(name)) {
			changes.push(additive('TYPE_ADDED', name, `The ${nextType.kind} '${name}' was added.`));
		}
	}

	return { kind: changes.some((change) => change.classification === 'BREAKING') ? 'BREAKING' : 'ADDITIVE', changes };
}

/**
 * Deprecated elements removed while the release their deprecation named is still ahead — plus
 * removed elements whose deprecation named no release at all, which is the same refusal with a
 * different fix.
 *
 * @param previous - The snapshot at the target revision.
 * @param next - The snapshot being proposed.
 * @param currentRelease - The release this change ships in.
 */
export function findEarlyDeprecationRemovals(
	previous: string,
	next: string,
	currentRelease: string
): readonly EarlyDeprecationRemoval[] {
	const before = readSchemaDocument(previous);
	const after = readSchemaDocument(next);
	const refusals: EarlyDeprecationRemoval[] = [];

	for (const [name, previousType] of before.types) {
		const nextType = after.types.get(name);
		if (!nextType) {
			// A removed type takes its deprecated members with it; every promise it breaks is
			// reported, so the author sees the whole list rather than the first entry.
			for (const field of previousType.fields.values()) {
				refuse(refusals, `${name}.${field.name}`, field.deprecation, currentRelease, `the type '${name}'`);
			}
			continue;
		}

		for (const [fieldName, previousField] of previousType.fields) {
			const nextField = nextType.fields.get(fieldName);
			if (!nextField) {
				refuse(refusals, `${name}.${fieldName}`, previousField.deprecation, currentRelease, `'${name}'`);
				continue;
			}
			for (const previousArgument of previousField.arguments) {
				if (nextField.arguments.some((argument) => argument.name === previousArgument.name)) continue;
				refuse(
					refusals,
					`${name}.${fieldName}(${previousArgument.name}:)`,
					previousArgument.deprecation,
					currentRelease,
					`'${name}.${fieldName}'`
				);
			}
		}
	}

	return refusals;
}

/**
 * Compares two dotted release identifiers, numerically per segment.
 *
 * @param left - The first release.
 * @param right - The second release.
 * @returns A negative number when `left` precedes `right`, zero when they match, positive otherwise.
 */
export function compareReleases(left: string, right: string): number {
	const leftParts = left.split('.');
	const rightParts = right.split('.');
	const length = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < length; index += 1) {
		const a = leftParts[index] ?? '0';
		const b = rightParts[index] ?? '0';
		if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
			const difference = Number(a) - Number(b);
			if (difference !== 0) return difference < 0 ? -1 : 1;
			continue;
		}
		if (a !== b) return a < b ? -1 : 1;
	}

	return 0;
}

/* ------------------------------------------------------------------ *
 * Comparison
 * ------------------------------------------------------------------ */

function classifyTypeMembers(name: string, previousType: SchemaTypeModel, nextType: SchemaTypeModel): SchemaChange[] {
	const changes: SchemaChange[] = [];
	const path = (field: string) => `${name}.${field}`;

	for (const [fieldName, previousField] of previousType.fields) {
		const nextField = nextType.fields.get(fieldName);

		if (!nextField) {
			changes.push(
				breaking(memberRemovalKind(previousType), path(fieldName), `'${path(fieldName)}' was removed from '${name}'.`)
			);
			continue;
		}

		if (nextType.kind === 'enum') continue;

		if (previousField.type !== nextField.type) {
			changes.push(
				compareTypeChange(path(fieldName), previousField, nextField, typeChangeKinds(previousType))
			);
		}

		changes.push(...classifyArguments(name, previousField, nextField));

		if (!previousField.deprecation && nextField.deprecation) {
			changes.push(
				additive(
					'DEPRECATION_ADDED',
					path(fieldName),
					`'${path(fieldName)}' is deprecated: ${nextField.deprecation.reason ?? DEFAULT_DEPRECATION_REASON}`
				)
			);
		}
		if (previousField.deprecation && !nextField.deprecation) {
			changes.push(
				additive(
					'DEPRECATION_REMOVED',
					path(fieldName),
					`'${path(fieldName)}' is no longer marked deprecated. A client that migrated away cannot tell.`
				)
			);
		}
	}

	for (const [fieldName, nextField] of nextType.fields) {
		if (previousType.fields.has(fieldName)) continue;

		if (nextType.kind === 'input') {
			changes.push(
				nextField.required
					? breaking(
							'INPUT_FIELD_ADDED',
							path(fieldName),
							`The input field '${path(fieldName)}' was added as required, so every existing caller now fails validation.`
						)
					: additive(
							'INPUT_FIELD_ADDED',
							path(fieldName),
							`The optional input field '${path(fieldName)}' was added.`
						)
			);
			continue;
		}

		changes.push(
			nextType.kind === 'enum'
				? additive('ENUM_VALUE_ADDED', path(fieldName), `The enum value '${path(fieldName)}' was added.`)
				: additive('FIELD_ADDED', path(fieldName), `The field '${path(fieldName)}' was added.`)
		);
	}

	for (const member of previousType.members) {
		if (!nextType.members.includes(member)) {
			changes.push(breaking('UNION_MEMBER_REMOVED', `${name}.${member}`, `'${member}' was removed from '${name}'.`));
		}
	}
	for (const member of nextType.members) {
		if (!previousType.members.includes(member)) {
			changes.push(additive('UNION_MEMBER_ADDED', `${name}.${member}`, `'${member}' was added to '${name}'.`));
		}
	}

	return changes;
}

function classifyArguments(name: string, previousField: SchemaFieldModel, nextField: SchemaFieldModel): SchemaChange[] {
	const changes: SchemaChange[] = [];
	const path = (argument: string) => `${name}.${previousField.name}(${argument}:)`;

	for (const previousArgument of previousField.arguments) {
		const nextArgument = nextField.arguments.find((argument) => argument.name === previousArgument.name);
		if (!nextArgument) {
			changes.push(
				breaking('ARGUMENT_REMOVED', path(previousArgument.name), `The argument '${path(previousArgument.name)}' was removed.`)
			);
			continue;
		}
		if (previousArgument.type !== nextArgument.type) {
			changes.push(
				compareTypeChange(path(previousArgument.name), previousArgument, nextArgument, ARGUMENT_TYPE_KINDS)
			);
		}
	}

	for (const nextArgument of nextField.arguments) {
		if (previousField.arguments.some((argument) => argument.name === nextArgument.name)) continue;
		changes.push(
			nextArgument.required
				? breaking(
						'ARGUMENT_ADDED',
						path(nextArgument.name),
						`The required argument '${path(nextArgument.name)}' was added, so every existing query fails validation.`
					)
				: additive('ARGUMENT_ADDED', path(nextArgument.name), `The optional argument '${path(nextArgument.name)}' was added.`)
		);
	}

	return changes;
}

/**
 * The change between two written types.
 *
 * Three questions, in order, because each one alone would misread a case:
 *
 * 1. are they the same named types, in the same order? `String` to `Int` is a type change, and the
 *    nullability marks say nothing about it;
 * 2. ignoring nullability, is the wrapper structure the same? `[String]` to `String` is a type
 *    change even though the one named type matches;
 * 3. then it is nullability alone: more `!` is a tightening (breaking), fewer is a relaxation.
 */
function compareTypeChange(
	path: string,
	previous: SchemaFieldModel,
	next: SchemaFieldModel,
	kinds: TypeChangeKinds
): SchemaChange {
	const sameTypes =
		namedTypes(previous.type).join('|') === namedTypes(next.type).join('|') &&
		withoutNullability(previous.type) === withoutNullability(next.type);

	if (!sameTypes) {
		return breaking(kinds.changed, path, `'${path}' changed type from '${previous.type}' to '${next.type}'.`);
	}

	const tightened = nullabilityCount(next.type) > nullabilityCount(previous.type);
	return tightened
		? breaking(
				kinds.tightened,
				path,
				`'${path}' became non-nullable ('${previous.type}' to '${next.type}'), so a caller that tolerated null must now handle a failure.`
			)
		: additive(
				kinds.relaxed,
				path,
				`'${path}' became nullable ('${previous.type}' to '${next.type}'); announce it, because a caller may now receive null.`
			);
}

const ARGUMENT_TYPE_KINDS: TypeChangeKinds = {
	changed: 'ARGUMENT_TYPE_CHANGED',
	tightened: 'ARGUMENT_TYPE_CHANGED',
	relaxed: 'ARGUMENT_TYPE_CHANGED'
};

const INPUT_FIELD_TYPE_KINDS: TypeChangeKinds = {
	changed: 'INPUT_FIELD_TYPE_CHANGED',
	tightened: 'INPUT_FIELD_TYPE_CHANGED',
	relaxed: 'INPUT_FIELD_TYPE_CHANGED'
};

function memberRemovalKind(type: SchemaTypeModel): SchemaChangeKind {
	if (type.kind === 'enum') return 'ENUM_VALUE_REMOVED';
	if (type.kind === 'input') return 'INPUT_FIELD_REMOVED';
	return 'FIELD_REMOVED';
}

function typeChangeKinds(type: SchemaTypeModel): TypeChangeKinds {
	return type.kind === 'input' ? INPUT_FIELD_TYPE_KINDS : FIELD_TYPE_KINDS;
}

/** The named types of a written type, in order: `[Role!]!` reads as `['Role']`. */
function namedTypes(type: string): string[] {
	return type.match(/[_0-9A-Za-z]+/g) ?? [];
}

/** The written type with every nullability mark removed: `[Role!]` becomes `[Role]`. */
function withoutNullability(type: string): string {
	return type.replace(/!/g, '');
}

function nullabilityCount(type: string): number {
	return (type.match(/!/g) ?? []).length;
}

function breaking(kind: SchemaChangeKind, path: string, detail: string): SchemaChange {
	return { kind, classification: 'BREAKING', path, detail };
}

function additive(kind: SchemaChangeKind, path: string, detail: string): SchemaChange {
	return { kind, classification: 'ADDITIVE', path, detail };
}

function refuse(
	refusals: EarlyDeprecationRemoval[],
	path: string,
	deprecation: DeprecationNotice | undefined,
	currentRelease: string,
	owner: string
): void {
	if (!deprecation) return;

	if (!deprecation.removalRelease) {
		refusals.push({
			path,
			deprecation,
			refusal:
				`'${path}' is deprecated but names no removal release, so the removal cannot be shown to be due. ` +
				`Restore it in ${owner}, or change the marker to ` +
				'`@deprecated(reason: "<replacement>; removal planned for <release>")` before removing it.'
		});
		return;
	}

	if (compareReleases(currentRelease, deprecation.removalRelease) < 0) {
		refusals.push({
			path,
			deprecation,
			refusal:
				`'${path}' was deprecated with removal planned for ${deprecation.removalRelease}, and this change ships in ` +
				`${currentRelease}. Keep it in ${owner} until then.`
		});
	}
}

/* ------------------------------------------------------------------ *
 * Reading one declaration
 * ------------------------------------------------------------------ */

/** What the enclosing block allows a declaration to be. */
type FieldMode = 'field' | 'input' | 'enum';

/**
 * Reads one field, input field or enum value line.
 *
 * @param line - The trimmed line.
 * @param mode - What the enclosing block may contain.
 */
function readField(line: string, mode: FieldMode): SchemaFieldModel | undefined {
	const name = /^([_A-Za-z][_0-9A-Za-z]*)/.exec(line)?.[1];
	if (!name) return undefined;

	let rest = line.slice(name.length).trim();
	let argumentsText: string | undefined;

	if (rest.startsWith('(')) {
		if (mode !== 'field') return undefined;
		const end = findClosing(rest, 0, '(', ')');
		if (end < 0) return undefined;
		argumentsText = rest.slice(1, end);
		rest = rest.slice(end + 1).trim();
	}

	if (mode === 'enum') {
		// An enum value is a bare name with optional directives and nothing else.
		if (rest && !rest.startsWith('@')) return undefined;
		return { name, type: '', arguments: [], required: false, deprecation: readDeprecation(rest) };
	}

	if (!rest.startsWith(':')) return undefined;
	rest = rest.slice(1).trim();

	const type = /^[\[\]_0-9A-Za-z!]+/.exec(rest)?.[0];
	if (!type) return undefined;
	rest = rest.slice(type.length).trim();

	let defaultValue: string | undefined;
	if (rest.startsWith('=')) {
		const value = rest.slice(1);
		const directiveAt = value.indexOf(' @');
		defaultValue = (directiveAt < 0 ? value : value.slice(0, directiveAt)).trim();
		rest = directiveAt < 0 ? '' : value.slice(directiveAt);
	}

	return {
		name,
		type,
		arguments: argumentsText ? readArguments(argumentsText) : [],
		required: type.endsWith('!') && defaultValue === undefined,
		deprecation: readDeprecation(rest)
	};
}

function readArguments(text: string): SchemaFieldModel[] {
	return splitArguments(text)
		.map((argument) => readField(argument, 'input'))
		.filter((argument): argument is SchemaFieldModel => !!argument);
}

/**
 * Splits an argument list into one string per argument.
 *
 * Both printed forms have to be read. `printSchema` separates arguments with commas when none of
 * them carries a description and with nothing but a line break when one does — and by the time this
 * runs, a line break inside the list has already been joined as a space. So a new argument is
 * recognised either at a comma or at the whitespace in front of a `name:`.
 *
 * @param text - The text between the parentheses.
 */
function splitArguments(text: string): string[] {
	const parts: string[] = [];
	let current = '';
	let depth = 0;
	let quoted = false;

	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];

		if (quoted) {
			current += character;
			if (character === '\\') {
				current += text[index + 1] ?? '';
				index += 1;
				continue;
			}
			if (character === '"') quoted = false;
			continue;
		}

		if (character === '"') {
			quoted = true;
			current += character;
			continue;
		}

		if (character === '(' || character === '[' || character === '{') depth += 1;
		if (character === ')' || character === ']' || character === '}') depth -= 1;

		if (depth === 0 && character === ',') {
			parts.push(current);
			current = '';
			continue;
		}

		if (depth === 0 && /\s/.test(character) && current.trim()) {
			const rest = text.slice(index + 1);
			if (/^[_A-Za-z][_0-9A-Za-z]*\s*:/.test(rest)) {
				parts.push(current);
				current = '';
				continue;
			}
		}

		current += character;
	}

	parts.push(current);
	return parts.map((part) => part.trim()).filter(Boolean);
}

/** The index of the bracket matching the one at `start`, or -1. */
function findClosing(text: string, start: number, open: string, close: string): number {
	let depth = 0;
	let quoted = false;

	for (let index = start; index < text.length; index += 1) {
		const character = text[index];
		if (quoted) {
			if (character === '\\') {
				index += 1;
				continue;
			}
			if (character === '"') quoted = false;
			continue;
		}
		if (character === '"') {
			quoted = true;
			continue;
		}
		if (character === open) depth += 1;
		if (character === close) {
			depth -= 1;
			if (depth === 0) return index;
		}
	}

	return -1;
}

/**
 * Reads the `@deprecated` marker out of the directives that follow a declaration.
 *
 * @param directives - The text after the declaration's type.
 */
function readDeprecation(directives: string): DeprecationNotice | undefined {
	const marker = /@deprecated\b/.exec(directives ?? '');
	if (!marker) return undefined;

	const after = directives.slice(marker.index + marker[0].length).trimStart();
	if (!after.startsWith('(')) {
		// A bare `@deprecated` names neither a replacement nor a release. The specification gives it
		// a default reason, but a default reason is exactly what an operator cannot act on, so it is
		// read as dated by nothing — which is what the snapshot validation and the removal gate must
		// see.
		return { reason: undefined };
	}

	const end = findClosing(after, 0, '(', ')');
	const body = end < 0 ? after.slice(1) : after.slice(1, end);
	const reasonMatch = /reason\s*:\s*("""[\s\S]*?"""|"(?:[^"\\]|\\.)*")/.exec(body);
	const reason = reasonMatch ? unquote(reasonMatch[1]) : undefined;
	const removal = reason ? /removal planned for\s+([0-9]+(?:\.[0-9]+)*)/i.exec(reason) : undefined;
	const head = reason ? reason.split(';')[0].trim() : undefined;

	return {
		reason,
		replacement: head && !/removal planned for/i.test(head) ? head : undefined,
		removalRelease: removal?.[1]
	};
}

function unquote(value: string): string {
	const inner = value.startsWith('"""') ? value.slice(3, -3) : value.slice(1, -1);
	return inner.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}
