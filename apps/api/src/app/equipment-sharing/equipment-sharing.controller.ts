import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Get,
	HttpCode,
	UseGuards,
	Put,
	Param,
	Body
} from '@nestjs/common';
import { CrudController, IPagination } from '../core';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService } from './equipment-sharing.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('EquipmentSharing')
@UseGuards(AuthGuard('jwt'))
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

	@ApiOperation({ summary: 'Update an existing record' })
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
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() equipmentSharing: EquipmentSharing
	): Promise<any> {
		return this.equipmentSharingService.update(id, equipmentSharing);
	}
}
