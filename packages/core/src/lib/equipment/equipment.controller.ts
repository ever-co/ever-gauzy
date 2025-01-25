import { CrudController, PaginationParams } from './../core/crud';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, UseGuards, HttpStatus, Get, Put, Param, Body, Query, Post } from '@nestjs/common';
import { IEquipment, IPagination } from '@gauzy/contracts';
import { Equipment } from './equipment.entity';
import { EquipmentService } from './equipment.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateEquipmentDTO, UpdateEquipmentDTO } from './dto';

@ApiTags('Equipment')
@UseGuards(TenantPermissionGuard)
@Controller('/equipment')
export class EquipmentController extends CrudController<Equipment> {
	constructor(private readonly equipmentService: EquipmentService) {
		super(equipmentService);
	}

	@ApiOperation({
		summary: 'Find all equipment sharings by pagination'
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
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() filter: PaginationParams<Equipment>): Promise<IPagination<IEquipment>> {
		return this.equipmentService.pagination(filter);
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
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IEquipment>> {
		const { relations, findInput } = data;
		return await this.equipmentService.findAll({
			where: {
				...findInput
			},
			relations
		});
	}

	@ApiOperation({ summary: 'New equipment record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateEquipmentDTO): Promise<IEquipment> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		return await this.equipmentService.create(entity);
	}

	@ApiOperation({ summary: 'Update an existing equipment' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateEquipmentDTO): Promise<IEquipment> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		return await this.equipmentService.create({
			id,
			...entity
		});
	}
}
