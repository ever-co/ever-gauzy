import { CrudController } from '../core';
import { Equipment } from './equipment.entity';
import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Equipment')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class EquipmentController extends CrudController<Equipment> {
	constructor(private equipmentService: EquipmentService) {
		super(equipmentService);
	}
}
