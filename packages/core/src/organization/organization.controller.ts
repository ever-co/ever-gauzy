import { IOrganization, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
	Query,
	BadRequestException
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FindOptionsWhere } from 'typeorm';
import { CrudController } from './../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { OrganizationCreateCommand, OrganizationUpdateCommand } from './commands';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDTO, OrganizationFindOptionsDTO, UpdateOrganizationDTO } from './dto';

@ApiTags('Organization')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class OrganizationController extends CrudController<Organization> {
	constructor(private readonly organizationService: OrganizationService, private readonly commandBus: CommandBus) {
		super(organizationService);
	}

	/**
	 * GET organization count
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<Organization>): Promise<number> {
		return await this.organizationService.countBy(options);
	}

	/**
	 * GET organization pagination
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() options: OrganizationFindOptionsDTO<Organization>): Promise<IPagination<IOrganization>> {
		return await this.organizationService.paginate(options);
	}

	/**
	 * GET organizations by find many conditions
	 *
	 * @param options
	 * @returns
	 */
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
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get()
	@UseValidationPipe({ transform: true })
	async findAll(@Query() options: OrganizationFindOptionsDTO<Organization>): Promise<IPagination<IOrganization>> {
		try {
			return await this.organizationService.findAll(options);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET organization by id
	 *
	 * @param id
	 * @param options
	 * @returns
	 */
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
	@Permissions()
	@Get(':id')
	@UseValidationPipe({ transform: true })
	async findById(
		@Param('id', UUIDValidationPipe) id: IOrganization['id'],
		@Query() options: OrganizationFindOptionsDTO<Organization>
	): Promise<IOrganization> {
		return await this.organizationService.findOneByIdString(id, options);
	}

	/**
	 * CREATE organization for specific tenant
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new Organization' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The Organization has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateOrganizationDTO): Promise<IOrganization> {
		return await this.commandBus.execute(new OrganizationCreateCommand(entity));
	}

	/**
	 * UPDATE organization by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update existing Organization' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The Organization has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: IOrganization['id'],
		@Body() entity: UpdateOrganizationDTO
	): Promise<IOrganization> {
		return await this.commandBus.execute(new OrganizationUpdateCommand(id, entity));
	}
}
