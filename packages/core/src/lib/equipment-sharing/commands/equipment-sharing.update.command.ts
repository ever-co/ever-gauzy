import { ICommand } from '@nestjs/cqrs';
import { ID, IEquipmentSharingUpdateInput } from '@gauzy/contracts';

export class EquipmentSharingUpdateCommand implements ICommand {
	static readonly type = '[EquipmentSharing] Update';

	constructor(public readonly id: ID, public readonly equipmentSharing: IEquipmentSharingUpdateInput) {}
}
