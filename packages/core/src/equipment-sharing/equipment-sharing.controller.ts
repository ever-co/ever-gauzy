import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Get,
	HttpCode,
	UseGuards,
	Put,
	Param,
	Body,
	Query
} from '@nestjs/common';
import { CrudController } from './../core/crud';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService } from './equipment-sharing.service';
import { IEquipmentSharing, IPagination, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
	EquipmentSharingStatusCommand,
	EquipmentSharingCreateCommand,
	EquipmentSharingUpdateCommand
} from './commands';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('EquipmentSharing')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EquipmentSharingController extends CrudController<EquipmentSharing> {
	constructor(
		private readonly equipmentSharingService: EquipmentSharingService,
		private commandBus: CommandBus
	) {
		super(equipmentSharingService);
	}

	/**
	 * GET equipment sharings by orgization id
	 * 
	 * @param orgId 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find equipment sharings By Orgization Id'
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
	@Get('/organization/:id')
	async findEquipmentSharingsByOrgId(
		@Param('id', UUIDValidationPipe) organizationId: string
	): Promise<IPagination<IEquipmentSharing>> {
		return this.equipmentSharingService.findEquipmentSharingsByOrgId(
			organizationId
		);
	}

	/**
	 * GET equipment sharings by employee id
	 * 
	 * @param employeeId 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find equipment sharings By Employee Id'
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
	@Get('employee/:id')
	async findEquipmentSharingsByEmployeeId(
		@Param('id', UUIDValidationPipe) employeeId: string
	): Promise<IPagination<IEquipmentSharing>> {
		return this.equipmentSharingService.findRequestApprovalsByEmployeeId(
			employeeId
		);
	}

	/**
	 * CREATE equipment sharing
	 * 
	 * @param organizationId 
	 * @param equipmentSharing 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Create an new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
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
	@Post('organization/:id')
	async createEquipmentSharing(
		@Param('id', UUIDValidationPipe) organizationId: string,
		@Body() equipmentSharing: EquipmentSharing
	): Promise<IEquipmentSharing> {
		return await this.commandBus.execute(
			new EquipmentSharingCreateCommand(
				organizationId,
				equipmentSharing
			)
		);
	}

	/**
	 * UPDATE equipment sharings request approval
	 * 
	 * @param id 
	 * @returns 
	 */
	@ApiOperation({ summary: 'equipment sharings request approval' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found equipment sharings',
		type: EquipmentSharing
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('approval/:id')
	async equipmentSharingsRequestApproval(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<IEquipmentSharing> {
		return await this.commandBus.execute(
			new EquipmentSharingStatusCommand(
				id,
				RequestApprovalStatusTypesEnum.APPROVED
			)
		);
	}

	/**
	 * UPDATE equipment sharings request refuse
	 * 
	 * @param id 
	 * @returns 
	 */
	@ApiOperation({ summary: 'equipment sharings request refuse' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found equipment sharings',
		type: EquipmentSharing
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('refuse/:id')
	async equipmentSharingsRequestRefuse(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<IEquipmentSharing> {
		return this.commandBus.execute(
			new EquipmentSharingStatusCommand(
				id,
				RequestApprovalStatusTypesEnum.REFUSED
			)
		);
	}

	/**
	 * GET all equipment sharings
	 * 
	 * @param data 
	 * @returns 
	 */
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEquipmentSharing>> {
		const { relations = [], findInput } = data;
		return this.equipmentSharingService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * UPDATE equipment sharing by id
	 * 
	 * @param id 
	 * @param equipmentSharing 
	 * @returns 
	 */
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
		@Param('id', UUIDValidationPipe) id: string,
		@Body() equipmentSharing: EquipmentSharing
	): Promise<IEquipmentSharing> {
		return await this.commandBus.execute(
			new EquipmentSharingUpdateCommand(id, equipmentSharing)
		);
	}
}
