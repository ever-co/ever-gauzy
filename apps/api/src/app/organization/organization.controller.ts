import { Controller, HttpStatus, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { Organization } from './organization.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';
import { UUIDValidationPipe } from '../shared';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';

@ApiTags('Organization')
@Controller()
export class OrganizationController extends CrudController<Organization> {
	constructor(private readonly organizationService: OrganizationService) {
		super(organizationService);
	}

	@ApiOperation({ summary: 'Find all organizations.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organizations',
		type: Organization
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get()
	async findAll(): Promise<IPagination<Organization>> {
		return this.organizationService.findAll();
	}

	@ApiOperation({ summary: 'Find Organization by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: Organization
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id/:select')
	async findOneById(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('select') select: string
	): Promise<Organization> {
		const findObj = {};

		if (select) {
			findObj['select'] = JSON.parse(select);
		}

		return this.organizationService.findOne(id, findObj);
	}
}
