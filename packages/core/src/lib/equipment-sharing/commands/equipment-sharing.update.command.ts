import { ICommand } from '@nestjs/cqrs';
import { EquipmentSharing } from '../equipment-sharing.entity';

export class EquipmentSharingUpdateCommand implements ICommand {
	static readonly type = '[EquipmentSharing] Update';

	constructor(
		public readonly id: string,
		public readonly equipmentSharing: EquipmentSharing
	) {}
}
