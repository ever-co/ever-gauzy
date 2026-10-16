import { BadRequestException } from '@nestjs/common';
import { EmployeeSettingDataOperationEnum, IEmployeeSettingDataOperation } from '@gauzy/contracts';

/** The most operations one data patch may carry. */
export const MAX_EMPLOYEE_SETTING_DATA_OPERATIONS = 100;

/** The deepest path an operation may name. */
export const MAX_EMPLOYEE_SETTING_DATA_PATH_DEPTH = 10;

/** Keys that would reach an object's prototype instead of the object itself. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

type JsonObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is JsonObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Applies data-patch operations to an employee setting's `data` and returns the new value. The input is not
 * modified.
 *
 * - `set` writes `value` at `path`, creating missing objects (or replacing `null`) on the way. A path running
 *   through an array or a scalar is refused, since there is no object key to write.
 * - `unset` removes the key at `path`; a path that is not there is a no-op.
 *
 * Operations apply in order, so a later one sees the result of an earlier one.
 *
 * @param data The stored data, as an object (a missing or non-object value starts from `{}`).
 * @param operations The operations to apply. Typed loosely on purpose: the function is the last guard for callers
 *   that skip the request DTO, so a missing list or a missing operation is refused here.
 * @returns The data with every operation applied.
 * @throws BadRequestException when an operation is malformed or its path cannot be written.
 */
export function applyEmployeeSettingDataOperations(
	data: unknown,
	operations: ReadonlyArray<IEmployeeSettingDataOperation | null | undefined> | null | undefined
): JsonObject {
	if (!Array.isArray(operations) || operations.length === 0) {
		throw new BadRequestException('A data patch needs at least one operation.');
	}
	if (operations.length > MAX_EMPLOYEE_SETTING_DATA_OPERATIONS) {
		throw new BadRequestException(
			`A data patch may carry at most ${MAX_EMPLOYEE_SETTING_DATA_OPERATIONS} operations.`
		);
	}

	const result: JsonObject = isPlainObject(data) ? structuredClone(data) : {};

	for (const operation of operations) {
		if (!operation) {
			throw new BadRequestException('Every operation of a data patch must be an object.');
		}
		const path = validatedPath(operation.path);
		const parent = path.slice(0, -1);
		const key = path[path.length - 1];

		switch (operation.op) {
			case EmployeeSettingDataOperationEnum.SET: {
				if (operation.value === undefined) {
					throw new BadRequestException(`A set operation needs a value (path ${describe(path)}).`);
				}
				const target = parent.reduce<JsonObject>((node, segment) => {
					// Own keys only: an inherited member (`toString`, `valueOf`, …) is not stored data.
					const child = Object.hasOwn(node, segment) ? node[segment] : undefined;
					if (child === undefined || child === null) {
						return (node[segment] = {});
					}
					if (!isPlainObject(child)) {
						throw new BadRequestException(`Cannot set ${describe(path)}: ${segment} is not an object.`);
					}
					return child;
				}, result);
				target[key] = structuredClone(operation.value);
				break;
			}
			case EmployeeSettingDataOperationEnum.UNSET: {
				let node: unknown = result;
				for (const segment of parent) {
					node = isPlainObject(node) && Object.hasOwn(node, segment) ? node[segment] : undefined;
				}
				if (isPlainObject(node)) {
					delete node[key];
				}
				break;
			}
			default:
				throw new BadRequestException(`Unknown data patch operation: ${String(operation.op)}.`);
		}
	}

	return result;
}

/**
 * Checks an operation's path: a non-empty list of non-empty string keys, not too deep, never a prototype key.
 */
function validatedPath(path: unknown): string[] {
	if (!Array.isArray(path) || path.length === 0) {
		throw new BadRequestException('An operation path needs at least one key.');
	}
	if (path.length > MAX_EMPLOYEE_SETTING_DATA_PATH_DEPTH) {
		throw new BadRequestException(
			`An operation path may be at most ${MAX_EMPLOYEE_SETTING_DATA_PATH_DEPTH} keys deep.`
		);
	}
	for (const segment of path) {
		if (typeof segment !== 'string' || segment.length === 0) {
			throw new BadRequestException('Every key of an operation path must be a non-empty string.');
		}
		if (FORBIDDEN_KEYS.has(segment)) {
			throw new BadRequestException(`An operation path may not use the key ${segment}.`);
		}
	}
	return path as string[];
}

const describe = (path: string[]): string => path.map((segment) => JSON.stringify(segment)).join(' > ');
