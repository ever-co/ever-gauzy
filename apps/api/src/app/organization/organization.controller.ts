import { OrganizationCreateInput, PermissionsEnum } from '@gauzy/models';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	UseGuards,
	Put,
	Query
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { UUIDValidationPipe } from '../shared';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { OrganizationCreateCommand } from './commands';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Organization')
@Controller()
export class OrganizationController extends CrudController<Organization> {
	constructor(
		private readonly organizationService: OrganizationService,
		private readonly commandBus: CommandBus
	) {
		super(organizationService);
	}

	@ApiOperation({ summary: 'Find all organizations within the tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organizations',
		type: Organization
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get()
	async findAllOrganizations(
		@Query('data') data: string
	): Promise<IPagination<Organization>> {
		const { relations, findInput } = JSON.parse(data);
		return this.organizationService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Find Organization by id within the tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: Organization
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(AuthGuard('jwt'))
	@Get(':id/:select')
	async findOneById(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('select') select: string,
		@Query('data') data: string
	): Promise<Organization> {
		const findObj = {};
		const { relations } = JSON.parse(data);
		if (select) {
			findObj['select'] = JSON.parse(select);
		}
		if (relations) {
			findObj['relations'] = JSON.parse(relations);
		}

		return this.organizationService.findOne(id, findObj);
	}

	@ApiOperation({ summary: 'Find Organization by profile link.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: Organization
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('profile/:profile_link/:select')
	async findOneByProfileLink(
		@Param('profile_link') profile_link: string,
		@Param('select') select: string
	): Promise<Organization> {
		return await this.organizationService.findByPublicLink(
			profile_link,
			select
		);
	}

	@ApiOperation({ summary: 'Create new Organization' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The Organization has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Post()
	async create(
		@Body() entity: OrganizationCreateInput
	): Promise<Organization> {
		return this.commandBus.execute(new OrganizationCreateCommand(entity));
	}
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: OrganizationCreateInput,
		...options: any[]
	): Promise<any> {
		return this.organizationService.create({
			id,
			...entity
		});
	}
}
