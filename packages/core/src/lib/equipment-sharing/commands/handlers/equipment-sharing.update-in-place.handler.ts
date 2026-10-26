import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { EquipmentSharingService } from '../../equipment-sharing.service';
import { EquipmentSharingUpdateInPlaceCommand } from '../equipment-sharing.update-in-place.command';

@CommandHandler(EquipmentSharingUpdateInPlaceCommand)
export class EquipmentSharingUpdateInPlaceHandler implements ICommandHandler<EquipmentSharingUpdateInPlaceCommand> {
	constructor(private readonly _equipmentSharingService: EquipmentSharingService) {}

	/**
	 * Edits an equipment sharing in place, at the version the edit is based on.
	 *
	 * Unlike `EquipmentSharingUpdateHandler` (the delete-then-recreate edit, kept for its documented contract), the row
	 * is written where it is: one statement predicated on the body's `version`, refused with 409
	 * `ENTITY_VERSION_CONFLICT` when the stored row has moved on. The scope checks are the same: the row is read in the
	 * caller's scope (404 otherwise), and what the body points it at and hands it to must be its organization's.
	 *
	 * @param command - The sharing's id and the edit.
	 * @returns The sharing, as written.
	 */
	public async execute(command: EquipmentSharingUpdateInPlaceCommand): Promise<EquipmentSharing> {
		const { id, input } = command;
		return await this._equipmentSharingService.updateInPlace(id, input);
	}
}
