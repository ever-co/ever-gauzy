import { CrudController } from '../core';
import { Equipment } from './equipment.entity';
import { ApiTags } from '@nestjs/swagger';
import { Controller } from '@nestjs/common';
import { EquipmentService } from './equipment.service';

@ApiTags('Equipment')
//todo
// @UseGuards(AuthGuard('jwt'))
@Controller()
export class EquipmentController extends CrudController<Equipment> {
	constructor(private equipmentService: EquipmentService) {
		super(equipmentService);
	}
}
