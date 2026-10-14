import { NotFoundException } from '@nestjs/common';
import { IOrderDeleteResult } from './types';

/**
 * Retires one row of this domain and answers what its `delete*` field reports.
 *
 * `13` §11.4 keeps every order table in one retention row — "`order*`, … | Indefinite | Soft delete only
 * (`deletedAt`); no hard delete through the API" — so a `delete*` field of this domain retires the row
 * through the service's `softRemove`, exactly as its `DELETE ':id'` route does, and never erases it. The
 * answer keeps the shape the field has always had: the identifier it named, and whether a row of the
 * caller's was there to act on.
 *
 * **Only a `NotFoundException` means "no row was there".** It is what the kernel's `softRemove` throws when
 * the identifier names no row in the caller's scope, and it is answered as `deleted: false`, as the hard
 * delete answered `affected: 0`. Anything else is a refusal or a failure, not an absence, and reaches the
 * caller as the error it is.
 *
 * @param id The identifier the field named.
 * @param retire The retirement, which is the service's `softRemove` of that identifier.
 * @returns The identifier, and whether a row was there to retire.
 */
export async function retireForDeleteField(id: string, retire: () => Promise<unknown>): Promise<IOrderDeleteResult> {
	try {
		await retire();

		return { id, deleted: true };
	} catch (error) {
		if (error instanceof NotFoundException) {
			return { id, deleted: false };
		}

		throw error;
	}
}
