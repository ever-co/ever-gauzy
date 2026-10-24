import { ForbiddenException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';

/**
 * The tenant/organization a record belongs to.
 */
export interface IReferenceScope {
	tenantId?: ID;
	organizationId?: ID;
}

/**
 * Looks a row up by scoped criteria. Returns something truthy when the row is in scope.
 */
export type ScopedLookup = (table: string, where: Record<string, unknown>) => Promise<unknown>;

/**
 * The rows a sharing points at, in every form a body can name them: the foreign-key column, or the related object
 * (`equipment: { id }`, `equipmentSharingPolicy: { id }`, `organization: { id }`) — which the ORM persists as the
 * foreign key just the same, MikroORM even when it is a bare id string.
 */
export interface ISharingReferences {
	equipmentId?: ID | null;
	equipment?: unknown;
	equipmentSharingPolicyId?: ID | null;
	equipmentSharingPolicy?: unknown;
	organizationId?: ID | null;
	organization?: unknown;
}

/**
 * A sharing payload once {@link withReferencesAsIds} has stated each reference as its column.
 */
export type ISharingColumns = Omit<ISharingReferences, 'equipment' | 'equipmentSharingPolicy' | 'organization'>;

/**
 * What a stored sharing holds of the rows it points at, as {@link sharingAsStored} reads it.
 */
export interface IStoredSharing {
	organizationId?: ID | null;
	equipmentId?: ID | null;
	equipmentSharingPolicyId?: ID | null;
}

/**
 * The id a related object names: its `id`, or the value itself when the body sent a bare id string.
 *
 * @param related - The related object as the body sent it.
 * @returns The id; `null` when the body clears the relation (`null`, or `{ id: null }`); `undefined` when it names
 * nothing (the key is absent, or the object carries no id).
 */
function relatedId(related: unknown): ID | null | undefined {
	if (related === null) {
		return null;
	}
	const id = typeof related === 'object' ? (related as { id?: unknown }).id : related;
	if (id === null) {
		return null;
	}
	return id === undefined || id === '' ? undefined : (id as ID);
}

/**
 * The one value a payload states for a reference it may name twice, as the column and as the related object.
 *
 * An id the related object names wins: it is the row the ORM would point at. Else the column, as stated. Else a
 * relation the body clears (`equipmentSharingPolicy: null`) clears the column too: dropping it instead would turn the
 * clearing into an omission, and an upsert would keep the stored reference.
 *
 * @param related - The related object as the body sent it.
 * @param column - The column as the body sent it.
 * @returns The id, `null` to clear the reference, or `undefined` when the payload states neither.
 */
function statedReference(related: unknown, column: ID | null | undefined): ID | null | undefined {
	const id = relatedId(related);
	if (id !== undefined && id !== null) {
		return id;
	}
	return column !== undefined ? column : id;
}

/**
 * Every `[table, id]` a sharing payload names, in both forms (see {@link ISharingReferences}), for
 * {@link assertReferencesAreInScope}. The column and the related object are both listed, so a payload that states
 * an in-scope column beside a foreign object is refused, whichever of the two the ORM would write.
 *
 * @param input - The create/update payload.
 * @returns The references to validate: the ids the payload states, an id stated twice listed once.
 */
export function sharingReferences(input: ISharingReferences): Array<readonly [string, ID | undefined]> {
	const references: Array<readonly [string, ID | null | undefined]> = [
		['equipment', input?.equipmentId],
		['equipment', relatedId(input?.equipment)],
		['equipment_sharing_policy', input?.equipmentSharingPolicyId],
		['equipment_sharing_policy', relatedId(input?.equipmentSharingPolicy)]
	];
	return references.filter(
		(reference, index): reference is readonly [string, ID] =>
			reference[1] !== undefined &&
			reference[1] !== null &&
			references.findIndex(([other, otherId]) => other === reference[0] && otherId === reference[1]) === index
	);
}

/**
 * A sharing payload with each reference stated once, as its foreign-key column.
 *
 * The related object's id wins over the column when the body carries both (the form sends both, with the same id):
 * it is the row the ORM would point at. The objects themselves are dropped, so the id that is checked is the id
 * that is stored, and nothing else the object carries reaches the write. A relation the body clears
 * (`equipmentSharingPolicy: null`) is kept as a cleared column (`equipmentSharingPolicyId: null`), so an upsert
 * still clears it — see {@link statedReference}.
 *
 * The organization is folded the same way (`organization: { id }` into `organizationId`): the scope a write is
 * checked in, the organization a handler pins and the organization-boundary guard of the CRUD base all read the
 * column, while the ORM wrote the row into the organization the object named.
 *
 * @param input - The create/update payload.
 * @returns The payload without `equipment` / `equipmentSharingPolicy` / `organization`, with their ids in the columns.
 */
export function withReferencesAsIds<T extends ISharingReferences>(
	input: T
): Omit<T, 'equipment' | 'equipmentSharingPolicy' | 'organization'> {
	const { equipment, equipmentSharingPolicy, organization, ...values } = (input ?? {}) as T;
	const equipmentId = statedReference(equipment, input?.equipmentId);
	const equipmentSharingPolicyId = statedReference(equipmentSharingPolicy, input?.equipmentSharingPolicyId);
	const organizationId = statedReference(organization, input?.organizationId);

	return {
		...values,
		...(equipmentId !== undefined ? { equipmentId } : {}),
		...(equipmentSharingPolicyId !== undefined ? { equipmentSharingPolicyId } : {}),
		...(organizationId !== undefined ? { organizationId } : {})
	};
}

/**
 * A `POST /equipment-sharing` payload read as the row it will store, for the scope check: the organization the row
 * lands in, the equipment and the policy it points at, and the payload to persist.
 *
 * The CRUD base's `create()` is an upsert by id. So the row lands in the organization the payload states (the
 * column; {@link withReferencesAsIds} has folded `organization: { id }` into it); else, when the payload carries the
 * id of a stored row, that row's own, which the write keeps; else the caller's, which the payload is then given so
 * that the new row is stored in the organization it was checked in. The references are the payload's, else the
 * stored row's: a payload that only moves a stored sharing to another organization has the equipment and the policy
 * the row keeps checked there. A row stored without an organization has its references held to the caller's.
 *
 * @param values - The payload, normalised by {@link withReferencesAsIds}.
 * @param stored - The stored row the payload's id names (tenant-scoped), or `null` when it names none.
 * @param callerOrganizationId - The caller's current organization.
 * @returns The payload to persist, the references to check and the organization to check them in.
 */
export function sharingAsStored<T extends ISharingColumns>(
	values: T,
	stored: IStoredSharing | null,
	callerOrganizationId: ID | null | undefined
): { values: T; references: IStoredSharing; organizationId: ID | undefined } {
	const payload: T =
		!stored && values.organizationId === undefined && callerOrganizationId
			? { ...values, organizationId: callerOrganizationId }
			: values;
	const asStored = (column: keyof IStoredSharing): ID | null | undefined =>
		payload[column] !== undefined ? payload[column] : stored?.[column];

	return {
		values: payload,
		references: {
			equipmentId: asStored('equipmentId'),
			equipmentSharingPolicyId: asStored('equipmentSharingPolicyId')
		},
		organizationId: asStored('organizationId') ?? callerOrganizationId ?? undefined
	};
}

/**
 * Refuses a referenced row that is not inside the given scope.
 *
 * The equipment-sharing update is a delete-then-recreate that spreads the request body, so a
 * body-supplied `equipmentId` or `equipmentSharingPolicyId` is persisted verbatim. Pinning the
 * record's own `organizationId` protects the ROW; it says nothing about what the row POINTS AT, and
 * the foreign key only proves the referenced row exists — not that it belongs here. Without this,
 * an update could re-attach a sharing to another organization's equipment.
 *
 * Lives in its own module, free of entity imports, so it can be unit-tested: importing the service
 * pulls in the entity graph and trips a pre-existing circular-import failure.
 *
 * @param references - `[table, id]` pairs to validate; entries without an id are skipped.
 * @param scope - The tenant/organization the referencing record belongs to.
 * @param lookup - Performs the scoped lookup.
 * @throws ForbiddenException when a reference is missing, or when there is no tenant to scope by.
 */
export async function assertReferencesAreInScope(
	references: ReadonlyArray<readonly [string, ID | undefined]>,
	scope: IReferenceScope,
	lookup: ScopedLookup
): Promise<void> {
	for (const [table, referenceId] of references) {
		if (!referenceId) {
			continue;
		}

		// An id is a string. Anything else (an operator object, a number) would be handed to the lookup as a
		// criterion rather than compared as a value, so it is refused rather than looked up.
		if (typeof referenceId !== 'string') {
			throw new ForbiddenException(`The referenced ${table.replace(/_/g, ' ')} is not available here`);
		}

		// Fail CLOSED without a tenant. An existence check that cannot be scoped proves nothing, and
		// answering "in scope" because there is no scope to compare against is how these guards rot.
		if (!scope.tenantId) {
			throw new ForbiddenException('Cannot validate the referenced record without a tenant context');
		}

		const where: Record<string, unknown> = { id: referenceId, tenantId: scope.tenantId };
		if (scope.organizationId) {
			where['organizationId'] = scope.organizationId;
		}

		if (!(await lookup(table, where))) {
			throw new ForbiddenException(`The referenced ${table.replace(/_/g, ' ')} is not available here`);
		}
	}
}
