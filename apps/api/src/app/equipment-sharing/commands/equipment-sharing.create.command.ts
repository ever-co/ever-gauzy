import { ICommand } from '@nestjs/cqrs';
import { EquipmentSharing } from '../equipment-sharing.entity';

export class EquipmentSharingCreateCommand implements ICommand {
	static readonly type = '[EquipmentSharing] Create';

	constructor(
		public readonly orgId: string,
		public readonly equipmentSharing: EquipmentSharing
	) {}
}
