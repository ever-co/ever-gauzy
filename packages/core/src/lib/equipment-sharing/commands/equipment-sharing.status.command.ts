import { ICommand } from '@nestjs/cqrs';

export class EquipmentSharingStatusCommand implements ICommand {
	static readonly type = '[EquipmentSharing] Status';

	constructor(public readonly id: string, public readonly status: number) {}
}
