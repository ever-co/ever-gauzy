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
	Post,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { IEquipment, IPagination } from '@gauzy/contracts';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CreateEquipmentDTO, UpdateEquipmentDTO } from './dto';

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

	@ApiOperation({ summary: 'Update an existing equipment' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put(':id')
	@UsePipes( new ValidationPipe({ transform : true }))
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateEquipmentDTO,
		...options: any[]
	): Promise<any> {
		return this.equipmentService.save(entity);
	}

	@ApiOperation({ summary: 'New equipment record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	@UsePipes( new ValidationPipe({ transform : true }) )
	async create(
		@Body() entity: CreateEquipmentDTO,
		...options: any[]
	): Promise<any> {
		return this.equipmentService.save(entity);
	}
}
