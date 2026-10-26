import { ICommand } from '@nestjs/cqrs';
import { ID, IEquipmentSharingUpdateInPlaceInput } from '@gauzy/contracts';

/**
 * Edits an equipment sharing in place, at the version the edit is based on (`PUT /equipment-sharing/:id/in-place`,
 * GraphQL `updateEquipmentSharingInPlace`). See `EquipmentSharingService.updateInPlace`.
 */
export class EquipmentSharingUpdateInPlaceCommand implements ICommand {
	static readonly type = '[EquipmentSharing] Update In Place';

	constructor(public readonly id: ID, public readonly input: IEquipmentSharingUpdateInPlaceInput) {}
}
