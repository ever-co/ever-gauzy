import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { RequestContext } from '../context/request-context';
import {
	CALLER_REFUSED_COLUMNS,
	RATE_EDITOR_COLUMNS,
	RATE_EDITOR_PERMISSION
} from './caller-restricted-columns.config';

enum ColumnRestriction {
	REFUSED = 'REFUSED',
	RATE_EDITORS_ONLY = 'RATE_EDITORS_ONLY'
}

interface RestrictedColumnUse {
	readonly path: string;
	readonly restriction: ColumnRestriction;
}

export interface CallerColumnCheckOptions {
	/**
	 * Set by reads whose argument is a bare `where`: the generic `count` routes hand the whole query string to
	 * `countBy`, so the query itself is what the caller filtered on.
	 */
	readonly queryIsWhere?: boolean;
}

const CALLER_FIND_OPTION_KEYS = ['where', 'order', 'select', 'findInput'] as const;

const LEGACY_DATA_PARAMETER = 'data';

const MAX_DEPTH = 12;

const PATH_SEPARATOR = '.';

const OPERATOR_PREFIX = '$';

/**
 * Refuses a read whose caller-supplied `where`, `order` or `select` names a restricted column, at any depth through
 * relations: a credential column for every caller, a rate column for anyone without the right that sets rates.
 *
 * Only what the caller sent counts. A restricted column in the read is refused when the current request's own
 * find options name it too, so the lookups services build themselves (sign-in by code, token and invite checks,
 * login by hash) run unchanged, and so does any read made while no request is in progress.
 *
 * @param metadata The metadata of the entity the read starts from.
 * @param read The find options about to be issued (`where`, `order` and `select` are inspected).
 * @param options See {@link CallerColumnCheckOptions}.
 * @throws BadRequestException when the caller names a credential column.
 * @throws ForbiddenException when the caller names a rate column without the right that sets rates.
 */
export function assertCallerColumnsAllowed(
	metadata: EntityMetadata | undefined,
	read: unknown,
	options: CallerColumnCheckOptions = {}
): void {
	if (!metadata || !isObject(read)) {
		return;
	}

	const callerPaths = callerSuppliedPaths(options);
	if (callerPaths.length === 0) {
		return;
	}

	const uses: RestrictedColumnUse[] = [];
	visitNode(metadata, read.where, [], uses, 0);
	visitNode(metadata, read.order, [], uses, 0);
	visitNode(metadata, read.select, [], uses, 0);

	for (const use of uses) {
		const namedByCaller = callerPaths.some((callerPath: string) => pathsOverlap(use.path, callerPath));
		if (namedByCaller) {
			assertUseAllowed(use);
		}
	}
}

function assertUseAllowed(use: RestrictedColumnUse): void {
	if (use.restriction === ColumnRestriction.REFUSED) {
		throw new BadRequestException(`'${use.path}' cannot be used to filter, sort or select records.`);
	}

	const editsRates = RequestContext.hasPermission(RATE_EDITOR_PERMISSION);
	if (!editsRates) {
		throw new ForbiddenException(
			`Filtering, sorting or selecting on '${use.path}' requires ${RATE_EDITOR_PERMISSION}.`
		);
	}
}

/**
 * Whether a restricted column reached by the read is the one the caller named. The caller's options may be mounted
 * under a relation by the route (`{ employee: where }`) or taken from below one, so either path may end the other.
 */
function pathsOverlap(readPath: string, callerPath: string): boolean {
	const samePath = readPath === callerPath;
	const callerMountedBelow = readPath.endsWith(PATH_SEPARATOR + callerPath);
	const callerTakenFromBelow = callerPath.endsWith(PATH_SEPARATOR + readPath);
	return samePath || callerMountedBelow || callerTakenFromBelow;
}

function visitNode(
	metadata: EntityMetadata,
	node: unknown,
	path: string[],
	uses: RestrictedColumnUse[],
	depth: number
): void {
	// Nothing below this depth is checked, so the read is refused rather than run unchecked
	if (depth > MAX_DEPTH) {
		throw new BadRequestException('The filter, sort or select is nested too deeply.');
	}

	if (Array.isArray(node)) {
		for (const item of node) {
			visitItem(metadata, item, path, uses, depth + 1);
		}
		return;
	}

	if (!isObject(node)) {
		return;
	}

	for (const [key, value] of Object.entries(node)) {
		visitSegments(metadata, splitPath(key), value, path, uses, depth + 1);
	}
}

/** An array holds conditions (`where: [a, b]`) or, in the legacy `select` form, property paths. */
function visitItem(
	metadata: EntityMetadata,
	item: unknown,
	path: string[],
	uses: RestrictedColumnUse[],
	depth: number
): void {
	if (typeof item === 'string') {
		visitSegments(metadata, splitPath(item), true, path, uses, depth);
		return;
	}
	visitNode(metadata, item, path, uses, depth);
}

function visitSegments(
	metadata: EntityMetadata,
	segments: string[],
	value: unknown,
	path: string[],
	uses: RestrictedColumnUse[],
	depth: number
): void {
	const [segment, ...rest] = segments;
	if (segment === undefined) {
		return;
	}

	if (segment.startsWith(OPERATOR_PREFIX)) {
		visitNode(metadata, value, path, uses, depth);
		return;
	}

	const nextPath = [...path, segment];
	const relation = metadata.findRelationWithPropertyPath?.(segment);
	const target = relation?.inverseEntityMetadata;

	if (target) {
		visitRelation(target, rest, value, nextPath, uses, depth);
		return;
	}

	const restriction = restrictionOf(metadata.name, segment);
	if (restriction) {
		uses.push({ path: nextPath.join(PATH_SEPARATOR), restriction });
	}
}

function visitRelation(
	target: EntityMetadata,
	rest: string[],
	value: unknown,
	path: string[],
	uses: RestrictedColumnUse[],
	depth: number
): void {
	if (rest.length > 0) {
		visitSegments(target, rest, value, path, uses, depth);
		return;
	}
	visitNode(target, value, path, uses, depth);
}

function restrictionOf(entityName: string, column: string): ColumnRestriction | null {
	const refused = columnsOf(CALLER_REFUSED_COLUMNS, entityName).includes(column);
	if (refused) {
		return ColumnRestriction.REFUSED;
	}

	const rateEditorsOnly = columnsOf(RATE_EDITOR_COLUMNS, entityName).includes(column);
	if (rateEditorsOnly) {
		return ColumnRestriction.RATE_EDITORS_ONLY;
	}

	return null;
}

function columnsOf(table: Readonly<Record<string, readonly string[]>>, entityName: string): readonly string[] {
	const declared = Object.hasOwn(table, entityName);
	if (!declared) {
		return [];
	}
	return table[entityName];
}

/**
 * Every property path the current request names in its find options: `where`, `order`, `select` and the legacy
 * `findInput`, from the query string and the body, and inside the legacy `data` JSON parameter.
 */
function callerSuppliedPaths(options: CallerColumnCheckOptions): string[] {
	const request = RequestContext.currentRequest();
	if (!request) {
		return [];
	}

	const trees: unknown[] = [];
	for (const source of [request.query, request.body]) {
		trees.push(...findOptionTreesOf(source), ...findOptionTreesOf(legacyDataOf(source)));
	}

	if (options.queryIsWhere) {
		trees.push(request.query);
	}

	const paths = new Set<string>();
	for (const tree of trees) {
		collectPaths(tree, [], paths, 0);
	}
	return [...paths];
}

function findOptionTreesOf(source: unknown): unknown[] {
	if (!isObject(source)) {
		return [];
	}
	const trees: unknown[] = [];
	for (const key of CALLER_FIND_OPTION_KEYS) {
		trees.push(source[key]);
	}
	return trees;
}

function legacyDataOf(source: unknown): unknown {
	if (!isObject(source)) {
		return undefined;
	}

	const data = source[LEGACY_DATA_PARAMETER];
	if (typeof data !== 'string') {
		return data;
	}

	try {
		return JSON.parse(data);
	} catch {
		return undefined;
	}
}

function collectPaths(node: unknown, path: string[], paths: Set<string>, depth: number): void {
	// A caller's options deeper than the check can follow would name nothing, and the read would run unchecked
	if (depth > MAX_DEPTH) {
		throw new BadRequestException('The filter, sort or select is nested too deeply.');
	}

	if (Array.isArray(node)) {
		for (const item of node) {
			collectItemPaths(item, path, paths, depth + 1);
		}
		return;
	}

	if (!isObject(node)) {
		return;
	}

	for (const [key, value] of Object.entries(node)) {
		const nextPath = [...path, ...withoutOperators(splitPath(key))];
		addPath(nextPath, paths);
		collectPaths(value, nextPath, paths, depth + 1);
	}
}

function collectItemPaths(item: unknown, path: string[], paths: Set<string>, depth: number): void {
	if (typeof item === 'string') {
		const itemPath = [...path, ...withoutOperators(splitPath(item))];
		addPath(itemPath, paths);
		return;
	}
	collectPaths(item, path, paths, depth);
}

function addPath(path: string[], paths: Set<string>): void {
	if (path.length > 0) {
		paths.add(path.join(PATH_SEPARATOR));
	}
}

function withoutOperators(segments: string[]): string[] {
	return segments.filter((segment: string) => !segment.startsWith(OPERATOR_PREFIX));
}

function splitPath(key: string): string[] {
	return key.split(PATH_SEPARATOR).filter((segment: string) => segment.length > 0);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
