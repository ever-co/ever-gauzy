import { EquipmentSharingStatusHandler } from './equipment-sharing.status.handler';
import { EquipmentSharingCreateHandler } from './equipment-sharing.create.handler';
import { EquipmentSharingUpdateHandler } from './equipment-sharing.update.handler';
import { EquipmentSharingUpdateInPlaceHandler } from './equipment-sharing.update-in-place.handler';

export const CommandHandlers = [
	EquipmentSharingStatusHandler,
	EquipmentSharingCreateHandler,
	EquipmentSharingUpdateHandler,
	EquipmentSharingUpdateInPlaceHandler
];
