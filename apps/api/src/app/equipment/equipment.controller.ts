import { CrudController, IPagination } from '../core';
import { Equipment } from './equipment.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	UseGuards,
	HttpStatus,
	Get,
	Put,
	Param,
	Body
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Equipment')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class EquipmentController extends CrudController<Equipment> {
	constructor(private equipmentService: EquipmentService) {
		super(equipmentService);
	}

	@ApiOperation({
		summary: 'Find all equipment sharings'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found equipment sharings',
		type: Equipment
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEquipmentSharings(): Promise<IPagination<Equipment>> {
		return this.equipmentService.getAll();
	}
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: Equipment,
		...options: any[]
	): Promise<any> {
		return this.equipmentService.create({
			id,
			...entity
		});
	}
}
