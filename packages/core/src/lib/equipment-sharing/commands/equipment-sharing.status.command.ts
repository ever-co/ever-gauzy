import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class EquipmentSharingStatusCommand implements ICommand {
	static readonly type = '[EquipmentSharing] Status';

	constructor(public readonly id: ID, public readonly status: number) {}
}
