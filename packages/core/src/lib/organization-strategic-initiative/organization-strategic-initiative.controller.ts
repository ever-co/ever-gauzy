import {
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
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID, IOrganizationStrategicInitiative, IOrganizationStrategicInitiativeFindInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from '../core/crud';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UseValidationPipe, UUIDValidationPipe } from '../shared/pipes';
import { OrganizationStrategicInitiative } from './organization-strategic-initiative.entity';
import { OrganizationStrategicInitiativeService } from './organization-strategic-initiative.service';
import {
	OrganizationStrategicInitiativeCreateCommand,
	OrganizationStrategicInitiativeUpdateCommand,
	OrganizationStrategicInitiativeUpdateSignalsCommand
} from './commands';
import {
	OrganizationStrategicInitiativeFindAllQuery,
	OrganizationStrategicInitiativeFindOneQuery,
	OrganizationStrategicInitiativeFindByProjectQuery
} from './queries';
import {
	CreateOrganizationStrategicInitiativeDTO,
	UpdateOrganizationStrategicInitiativeDTO,
	UpdateOrganizationStrategicSignalsDTO
} from './dto';

@ApiTags('OrganizationStrategicInitiative')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/organization-strategic-initiative')
export class OrganizationStrategicInitiativeController extends CrudController<OrganizationStrategicInitiative> {
	constructor(
		private readonly _organizationStrategicInitiativeService: OrganizationStrategicInitiativeService,
		private readonly _commandBus: CommandBus,
		private readonly _queryBus: QueryBus
	) {
		super(_organizationStrategicInitiativeService);
	}

	/**
	 * GET all organization strategic initiatives with optional filters
	 *
	 * @param params - Query parameters for filtering
	 * @returns Paginated list of organization strategic initiatives
	 */
	@ApiOperation({ summary: 'Find all organization strategic initiatives with optional filters' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization strategic initiatives',
		type: OrganizationStrategicInitiative,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ)
	@Get()
	@UseValidationPipe()
	async findAll(
		@Query() params: BaseQueryDTO<OrganizationStrategicInitiative> & IOrganizationStrategicInitiativeFindInput
	): Promise<IPagination<IOrganizationStrategicInitiative>> {
		return await this._queryBus.execute(new OrganizationStrategicInitiativeFindAllQuery(params));
	}

	/**
	 * GET organization strategic initiatives by project ID
	 *
	 * @param projectId - The project ID
	 * @returns List of organization strategic initiatives linked to the project
	 */
	@ApiOperation({ summary: 'Find organization strategic initiatives by project' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization strategic initiatives for project',
		type: OrganizationStrategicInitiative,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Project not found'
	})
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ)
	@Get('project/:projectId')
	async findByProject(
		@Param('projectId', UUIDValidationPipe) projectId: ID
	): Promise<IOrganizationStrategicInitiative[]> {
		return await this._queryBus.execute(new OrganizationStrategicInitiativeFindByProjectQuery(projectId));
	}

	/**
	 * GET an organization strategic initiative by ID
	 *
	 * @param id - The organization strategic initiative ID
	 * @param params - Optional query parameters
	 * @returns The organization strategic initiative
	 */
	@ApiOperation({ summary: 'Find an organization strategic initiative by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization strategic initiative',
		type: OrganizationStrategicInitiative
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: BaseQueryDTO<OrganizationStrategicInitiative>
	): Promise<IOrganizationStrategicInitiative> {
		return await this._queryBus.execute(new OrganizationStrategicInitiativeFindOneQuery(id, params));
	}

	/**
	 * CREATE a new organization strategic initiative
	 *
	 * @param entity - The organization strategic initiative data
	 * @returns The created organization strategic initiative
	 */
	@ApiOperation({ summary: 'Create a new organization strategic initiative' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Organization strategic initiative created successfully',
		type: OrganizationStrategicInitiative
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(
		@Body() entity: CreateOrganizationStrategicInitiativeDTO
	): Promise<IOrganizationStrategicInitiative> {
		return await this._commandBus.execute(new OrganizationStrategicInitiativeCreateCommand(entity));
	}

	/**
	 * UPDATE an organization strategic initiative by ID
	 *
	 * @param id - The organization strategic initiative ID
	 * @param entity - The updated organization strategic initiative data
	 * @returns The updated organization strategic initiative
	 */
	@ApiOperation({ summary: 'Update an organization strategic initiative' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Organization strategic initiative updated successfully',
		type: OrganizationStrategicInitiative
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE)
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrganizationStrategicInitiativeDTO
	): Promise<IOrganizationStrategicInitiative | UpdateResult> {
		return await this._commandBus.execute(new OrganizationStrategicInitiativeUpdateCommand(id, entity));
	}

	/**
	 * UPDATE strategic signals of an organization strategic initiative
	 *
	 * @param id - The organization strategic initiative ID
	 * @param signals - The strategic signals data
	 * @returns The updated organization strategic initiative
	 */
	@ApiOperation({ summary: 'Update strategic signals of an organization strategic initiative' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Strategic signals updated successfully',
		type: OrganizationStrategicInitiative
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE)
	@HttpCode(HttpStatus.OK)
	@Put(':id/signals')
	@UseValidationPipe({ transform: true })
	async updateSignals(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() signals: UpdateOrganizationStrategicSignalsDTO
	): Promise<IOrganizationStrategicInitiative> {
		return await this._commandBus.execute(new OrganizationStrategicInitiativeUpdateSignalsCommand(id, signals));
	}

	/**
	 * DELETE an organization strategic initiative by ID
	 *
	 * @param id - The organization strategic initiative ID
	 * @returns Delete result
	 */
	@ApiOperation({ summary: 'Delete an organization strategic initiative' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Organization strategic initiative deleted successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_DELETE)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this._organizationStrategicInitiativeService.delete(id);
	}
}
