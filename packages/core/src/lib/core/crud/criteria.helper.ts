import { BadRequestException } from '@nestjs/common';

/**
 * Rejects `update` / `delete` / `softDelete` criteria that carry no usable predicate.
 *
 * TypeORM refuses `undefined`, `null`, `''`, `[]` and `{}` itself, but it does NOT refuse an object
 * whose values are all `undefined` — and, because an `undefined` where value is (and must remain)
 * omitted from the SQL, `{ employeeId: undefined }` produced an UNFILTERED `DELETE FROM ...` /
 * `UPDATE ... SET ...` over the whole table. A missing request field or an absent
 * RequestContext id is all it took (GHSA-44pv-34gx-q9p4 class). Fail closed instead.
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
	if (typeof criteria === 'object' && !Array.isArray(criteria) && !(criteria instanceof Date)) {
		const hasPredicate = Object.values(criteria as Record<string, unknown>).some((value) => value !== undefined);
		if (!hasPredicate) {
			throw new BadRequestException(`Empty criteria(s) are not allowed for the ${method} method.`);
		}
	}
}
