import { IOrganization, IOrganizationCreateInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { isNotEmpty } from '@gauzy/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { Permissions, Public } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { OrganizationCreateCommand, OrganizationUpdateCommand } from './commands';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';


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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganization>> {
		const { relations, findInput } = data;
		return await this.organizationService.findAll({
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
	@Get(':id/:select')
	async findOneById(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('select', ParseJsonPipe) select: any,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IOrganization> {
		const request = {};
		const { relations } = data;
		if (isNotEmpty(select)) {
			request['select'] = select;
		}
		if (isNotEmpty(relations)) {
			request['relations'] = relations;
		}
		return await this.organizationService.findOne(id, request);
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
	@Get('profile/:profile_link/:select/:relations')
	@Public()
	async findOneByProfileLink(
		@Param('profile_link') profile_link: string,
		@Param('select') select: string,
		@Param('relations') relations: string
	): Promise<IOrganization> {
		return await this.organizationService.findByPublicLink(
			profile_link,
			select,
			relations
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Post()
	async create(
		@Body() entity: IOrganizationCreateInput
	): Promise<IOrganization> {
		return await this.commandBus.execute(
			new OrganizationCreateCommand(entity)
		);
	}

	@ApiOperation({ summary: 'Update existing Organization' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The Organization has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.OK)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IOrganizationCreateInput,
		...options: any[]
	): Promise<IOrganization> {
		return await this.commandBus.execute(
			new OrganizationUpdateCommand({ id, ...entity })
		);
	}
}
