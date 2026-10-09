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
import { ID, IOrganizationEmploymentType, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { OrganizationEmploymentTypeService } from './organization-employment-type.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { AbstractValidationPipe, ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantOrganizationBaseDTO } from './../core/dto';

@ApiTags('OrganizationEmploymentType')
@UseGuards(TenantPermissionGuard)
@Controller('/organization-employment-type')
export class OrganizationEmploymentTypeController extends CrudController<OrganizationEmploymentType> {
	constructor(private readonly organizationEmploymentTypeService: OrganizationEmploymentTypeService) {
		super(organizationEmploymentTypeService);
	}

	/**
	 * GET all organization employment types
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization employment types.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employment types',
		type: OrganizationEmploymentType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationEmploymentType>> {
		const { findInput, relations } = data;
		return this.organizationEmploymentTypeService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * UPDATE organization employment type by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: OrganizationEmploymentType
	): Promise<IOrganizationEmploymentType> {
		try {
			return this.organizationEmploymentTypeService.create({ ...entity, id });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * CREATE organization employment type
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
	async create(@Body() entity: DeepPartial<OrganizationEmploymentType>): Promise<OrganizationEmploymentType> {
		return super.create(entity);
	}

	/**
	 * DELETE organization employment type by id
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
	 * SOFT DELETE organization employment type by id
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationEmploymentType> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted organization employment type by id
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationEmploymentType> {
		return super.softRecover(id, ...options);
	}
}
