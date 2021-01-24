import { EquipmentSharingStatusHandler } from './equipment-sharing.status.handler';
import { EquipmentSharingCreateHandler } from './equipment-sharing.create.handler';
import { EquipmentSharingUpdateHandler } from './equipment-sharing.update.handler';

export const CommandHandlers = [
	EquipmentSharingStatusHandler,
	EquipmentSharingCreateHandler,
	EquipmentSharingUpdateHandler
];
