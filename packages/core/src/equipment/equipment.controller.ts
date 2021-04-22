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
	Body,
	Query,
	Post
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('Equipment')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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
	async findAllEquipmentSharings(
		@Query('data') data: string
	): Promise<IPagination<Equipment>> {
		const { relations, findInput } = JSON.parse(data);
		return await this.equipmentService.findAll({
			where: {
				...findInput
			},
			relations
		});
	}
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: Equipment,
		...options: any[]
	): Promise<any> {
		return this.equipmentService.save(entity);
	}

	@Post()
	async create(@Body() entity: Equipment, ...options: any[]): Promise<any> {
		return this.equipmentService.save(entity);
	}
}
