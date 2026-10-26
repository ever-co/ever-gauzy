import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusTypesEnum, ApprovalPolicyTypesStringEnum } from '@gauzy/contracts';
import { bumpVersion } from '../../../concurrency/version.util';
import { RequestApprovalService } from '../../../request-approval/request-approval.service';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { EquipmentSharingUpdateCommand } from '../equipment-sharing.update.command';
import { EquipmentSharingService } from '../../equipment-sharing.service';
import { withReferencesAsIds } from '../../reference-scope.helper';
import { expectedSharingVersion } from '../../sharing-version.helper';

@CommandHandler(EquipmentSharingUpdateCommand)
export class EquipmentSharingUpdateHandler implements ICommandHandler<EquipmentSharingUpdateCommand> {
	constructor(
		private readonly _equipmentSharingService: EquipmentSharingService,
		private readonly _requestApprovalService: RequestApprovalService
	) {}

	/**
	 * Executes an update for an Equipment Sharing record.
	 *
	 * The edit is a compare-and-set on the version it is based on: the `version` the body states, else the one the
	 * read below finds. The row is removed only at that version, so of two edits based on the same version one goes
	 * through and the other is refused with 409 `ENTITY_VERSION_CONFLICT` before it has removed or written anything;
	 * two overlapping edits used to recreate the row one over the other and keep some columns of each
	 * (ever-co/ever-gauzy#11359). The recreated row carries the next version.
	 *
	 * @param command - The EquipmentSharingUpdateCommand containing the record's ID and the updated equipment sharing data.
	 * @returns A promise that resolves to the updated EquipmentSharing record.
	 */
	public async execute(command: EquipmentSharingUpdateCommand): Promise<EquipmentSharing> {
		const { id } = command;
		// Each reference stated once, as its column: the related objects (`equipment: { id }`,
		// `equipmentSharingPolicy: { id }`) are what the recreate below persisted, and the check did not read them.
		const input = withReferencesAsIds(command.input);

		// Read the row BEFORE destroying it: this is a delete-then-recreate, so the scope it is
		// recreated in has to come from the record rather than from the request. `findOneByIdString`
		// is tenant-scoped and throws NotFoundException, which also stops an unknown id being
		// recreated as a brand-new row.
		const existing = await this._equipmentSharingService.findOneByIdString(id);

		// The version the edit is based on (400 for a body version that is not one).
		const expected = expectedSharingVersion(command.input?.version, existing.version);

		// A pinned organizationId protects the ROW; it says nothing about what the row POINTS AT. The
		// body's equipmentId / equipmentSharingPolicyId are persisted verbatim by the recreate below,
		// and their foreign keys only prove the rows exist — not that they belong here.
		await this._equipmentSharingService.assertReferencesAreInScope(input, {
			tenantId: existing.tenantId,
			organizationId: existing.organizationId
		});

		// Delete the existing Equipment Sharing record — only at the version the edit is based on, which is the
		// compare-and-set (409 otherwise) — and then its associated Request Approval.
		await this._equipmentSharingService.deleteAtVersion(id, expected);
		await this._requestApprovalService.delete({ requestId: id });

		// Save the updated Equipment Sharing record under the path id (a body-supplied id must not
		// re-point the write at another row; the raw body is not DTO-validated). The organization is
		// pinned from the stored row for the same reason: nothing checks a body `organizationId`
		// against the caller's organizations, so an update could otherwise move the record. The version
		// is the next one, whatever the body states.
		const equipmentSharing = await this._equipmentSharingService.create({
			...input,
			id,
			organizationId: existing.organizationId,
			tenantId: existing.tenantId,
			version: bumpVersion(expected)
		});

		// Create a new request approval record for the updated equipment sharing.
		await this._requestApprovalService.create({
			requestId: equipmentSharing.id,
			requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
			status: equipmentSharing.status ?? RequestApprovalStatusTypesEnum.REQUESTED,
			name: equipmentSharing.name,
			min_count: 1,
			organizationId: existing.organizationId,
			tenantId: existing.tenantId
		});

		return equipmentSharing;
	}
}
