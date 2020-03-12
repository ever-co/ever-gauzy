import { ApiTags } from '@nestjs/swagger';
import { Controller } from '@nestjs/common';
import { CrudController } from '../core';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService } from './equipment-sharing.service';

@ApiTags('EquipmentSharing')
// @UseGuards(AuthGuard('jwt'))
@Controller()
export class EquipmentSharingController extends CrudController<
	EquipmentSharing
> {
	constructor(
		private readonly equipmentSharingService: EquipmentSharingService
	) {
		super(equipmentSharingService);
	}
}
