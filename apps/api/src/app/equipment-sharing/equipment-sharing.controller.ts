import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, HttpStatus, Get } from '@nestjs/common';
import { CrudController, IPagination } from '../core';
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

	@ApiOperation({
		summary: 'Find all equipment sharings'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found equipment sharings',
		type: EquipmentSharing
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEquipmentSharings(): Promise<IPagination<EquipmentSharing>> {
		return this.equipmentSharingService.findAllEquipmentSharings();
	}
}
