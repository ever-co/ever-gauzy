import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, IOrganizationPosition, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { OrganizationPositionService } from './organization-position.service';
import { OrganizationPosition } from './organization-position.entity';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { AbstractValidationPipe, ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { TenantOrganizationBaseDTO } from './../core/dto';
import { UpdateOrganizationPositionDTO } from './dto';

@ApiTags('OrganizationPositions')
@UseGuards(TenantPermissionGuard)
@Controller('/organization-positions')
export class OrganizationPositionController extends CrudController<OrganizationPosition> {
	constructor(private readonly organizationPositionService: OrganizationPositionService) {
		super(organizationPositionService);
	}

	/**
	 * GET organization positions recurring expense
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization positions recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found positions recurring expense',
		type: OrganizationPosition
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationPosition>> {
		const { relations = [], findInput } = data;
		return this.organizationPositionService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * UPDATE organization position by id
	 *
	 * @param id
	 * @param body
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: UpdateOrganizationPositionDTO
	): Promise<IOrganizationPosition> {
		try {
			return this.organizationPositionService.create({ ...body, id });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * CREATE organization position
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach the permission gate:
	 * `PermissionGuard` authorizes any route that carries no `@Permissions` metadata, so an
	 * inherited handler is reachable by every member of the tenant until it is gated here.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The record has been successfully created.' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<OrganizationPosition>): Promise<OrganizationPosition> {
		return super.create(entity);
	}

	/**
	 * DELETE organization position by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully deleted' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE organization position by id
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationPosition> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted organization position by id
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationPosition> {
		return super.softRecover(id, ...options);
	}
}
