import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';

/**
 * Whether a criteria VALUE contributes at least one usable predicate once TypeORM has omitted every
 * `undefined` leaf. Find operators and dates are atomic predicates; a nested object (relation /
 * embedded criteria) counts only if one of its own leaves does; an array (an OR of criteria) counts
 * only if one of its branches does.
 */
function hasPredicate(value: unknown): boolean {
	if (value === undefined) {
		return false;
	}
	if (value === null) {
		// A real predicate under TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR (`IS NULL`).
		return true;
	}
	if (value instanceof FindOperator || value instanceof Date) {
		return true;
	}
	if (Array.isArray(value)) {
		return value.length > 0 && value.some((item) => hasPredicate(item));
	}
	if (typeof value === 'object') {
		return Object.values(value as Record<string, unknown>).some((nested) => hasPredicate(nested));
	}
	return true;
}

/**
 * Rejects `update` / `delete` / `softDelete` criteria that carry no usable predicate.
 *
 * TypeORM refuses `undefined`, `null`, `''`, `[]` and `{}` itself, but it does NOT refuse an object
 * whose leaves are all `undefined` — and, because an `undefined` where value is (and must remain)
 * omitted from the SQL, `{ employeeId: undefined }` — or the nested `{ employee: { id: undefined } }` —
 * produced an UNFILTERED `DELETE FROM ...` / `UPDATE ... SET ...` over the whole table. A missing
 * request field or an absent RequestContext id is all it took (GHSA-44pv-34gx-q9p4 class). Fail
 * closed instead. The check is recursive: relation / embedded objects and OR-arrays are only accepted
 * when at least one leaf survives.
 *
 * `null` values are left alone: under TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR they are a real
 * predicate (`IS NULL`).
 *
 * @param criteria - The id / where-object handed to the write method.
 * @param method - Name of the calling method, for the error message.
 */
export function assertCriteriaHasPredicate(criteria: unknown, method: string): void {
	if (criteria === undefined || criteria === null || criteria === '') {
		throw new BadRequestException(`Empty criteria(s) are not allowed for the ${method} method.`);
	}
	if (typeof criteria === 'object' && !(criteria instanceof Date) && !(criteria instanceof FindOperator)) {
		if (!hasPredicate(criteria)) {
			throw new BadRequestException(`Empty criteria(s) are not allowed for the ${method} method.`);
		}
	}
}
