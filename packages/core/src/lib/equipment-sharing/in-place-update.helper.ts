import { HttpStatus } from '@nestjs/common';
import { ID, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { ISharingMembers, ISharingReferences, withReferencesAsIds } from './reference-scope.helper';

/**
 * The columns the in-place edit of a sharing writes (`PUT /equipment-sharing/:id/in-place`, GraphQL
 * `updateEquipmentSharingInPlace`), each only when the body states it.
 *
 * Not among them: the identifier (the path's), the tenant and the organization (the row's own, pinned as the edit
 * that removes and files the row again pins them), the version (the precondition, moved on by the write itself), and
 * the audit columns.
 */
export const IN_PLACE_SHARING_COLUMNS = [
	'name',
	'shareRequestDay',
	'shareStartDay',
	'shareEndDay',
	'status',
	'equipmentId',
	'equipmentSharingPolicyId'
] as const;

/** One of {@link IN_PLACE_SHARING_COLUMNS}. */
export type InPlaceSharingColumn = (typeof IN_PLACE_SHARING_COLUMNS)[number];

/**
 * The memberships the in-place edit replaces, each only when the body states it: the ids of the employees, and of the
 * teams, the asset is handed to. An empty list clears the membership; a list left out leaves it as it is.
 */
export interface IInPlaceSharingMembers {
	employees?: ID[];
	teams?: ID[];
}

/** What an in-place edit writes. */
export interface IInPlaceSharingChange {
	/** The columns the body states, each reference as its foreign-key column. */
	columns: Partial<Record<InPlaceSharingColumn, unknown>>;
	/** The memberships the body states. */
	members: IInPlaceSharingMembers;
}

/** The statuses a sharing carries: the request approval's own vocabulary. */
const SHARING_STATUSES: ReadonlyArray<number> = [
	RequestApprovalStatusTypesEnum.REQUESTED,
	RequestApprovalStatusTypesEnum.APPROVED,
	RequestApprovalStatusTypesEnum.REFUSED
];

/**
 * The id one entry of a membership list names: a bare id, or a related object's `id`. `null` when it names none.
 *
 * @param entry One entry of the list, as the body sent it.
 */
function memberId(entry: unknown): ID | null {
	const id =
		typeof entry === 'string' ? entry : entry && typeof entry === 'object' ? (entry as { id?: unknown }).id : undefined;
	return typeof id === 'string' && id.trim() !== '' ? id : null;
}

/**
 * The ids a membership list names, each once, or `undefined` when the body does not state the list. `null` states an
 * empty list, which clears the membership.
 *
 * Unlike the membership check of the other writes (`sharingMemberReferences`, which skips an entry that names no id),
 * a list with such an entry is refused as a whole: this edit *replaces* the membership with the list, so skipping
 * the entry would write a shorter list than the caller meant — `{ employees: [{}] }` would clear every employee.
 *
 * @param members The list as the body sent it (related objects or bare ids).
 * @param field The member of the body the list is.
 * @throws ApiException 400 `VALIDATION_FAILED` for a value that is not a list, or a list with an entry naming no id.
 */
function statedMembers(members: unknown, field: 'employees' | 'teams'): ID[] | undefined {
	if (members === undefined) {
		return undefined;
	}
	if (members === null) {
		return [];
	}
	const ids = Array.isArray(members) ? members.map(memberId) : null;
	if (!ids || ids.some((id) => id === null)) {
		throw new ApiException(
			HttpStatus.BAD_REQUEST,
			ApiErrorCode.VALIDATION_FAILED,
			`The ${field} of an equipment sharing are a list, each entry an id or an object with its id.`,
			{ field }
		);
	}
	return ids.filter((id, index) => ids.indexOf(id) === index) as ID[];
}

/**
 * Reads what an in-place edit of a sharing writes, out of the raw body (the route's body is not DTO-validated).
 *
 * The references are read as the edit that removes and files the row again reads them ({@link withReferencesAsIds}):
 * the related object's id wins over the column, and the objects themselves are dropped. Only the columns of
 * {@link IN_PLACE_SHARING_COLUMNS} that the body states are written; every other member is ignored.
 *
 * @param input The raw body.
 * @returns The columns and the memberships to write.
 * @throws ApiException 400 `VALIDATION_FAILED` for a stated `status` that is not one of the request approval's
 * statuses (the column is `NOT NULL`, so a stated `null` is refused too), or a membership list that is not a list of
 * ids (see {@link statedMembers}).
 */
export function inPlaceSharingChange(
	input: (ISharingReferences & ISharingMembers & Record<string, unknown>) | null | undefined
): IInPlaceSharingChange {
	const body = (input ?? {}) as ISharingReferences & ISharingMembers & Record<string, unknown>;
	const values = withReferencesAsIds(body) as Record<string, unknown>;

	const columns: Partial<Record<InPlaceSharingColumn, unknown>> = {};
	for (const column of IN_PLACE_SHARING_COLUMNS) {
		if (values[column] !== undefined) {
			columns[column] = values[column];
		}
	}

	if (columns.status !== undefined && !SHARING_STATUSES.includes(columns.status as number)) {
		throw new ApiException(
			HttpStatus.BAD_REQUEST,
			ApiErrorCode.VALIDATION_FAILED,
			'The status of an equipment sharing is 1 (requested), 2 (approved) or 3 (refused).',
			{ field: 'status' }
		);
	}

	const members: IInPlaceSharingMembers = {};
	const employees = statedMembers(body.employees, 'employees');
	const teams = statedMembers(body.teams, 'teams');
	if (employees) {
		members.employees = employees;
	}
	if (teams) {
		members.teams = teams;
	}

	return { columns, members };
}
