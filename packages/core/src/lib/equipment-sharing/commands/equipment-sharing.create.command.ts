import { ICommand } from '@nestjs/cqrs';
import { ID, IEquipmentSharingCreateInput } from '@gauzy/contracts';

export class EquipmentSharingCreateCommand implements ICommand {
	static readonly type = '[EquipmentSharing] Create';

	constructor(public readonly equipmentSharing: IEquipmentSharingCreateInput) {}
}
