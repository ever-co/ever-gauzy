import { CrudController } from './../core/crud';
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
import { IEquipment, IPagination } from '@gauzy/contracts';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('Equipment')
@UseGuards(TenantPermissionGuard)
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEquipment>> {
		const { relations, findInput } = data;
		return await this.equipmentService.findAll({
			where: {
				...findInput
			},
			relations
		});
	}
	
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IEquipment,
		...options: any[]
	): Promise<any> {
		return this.equipmentService.save(entity);
	}

	@Post()
	async create(
		@Body() entity: IEquipment,
		...options: any[]
	): Promise<any> {
		return this.equipmentService.save(entity);
	}
}
