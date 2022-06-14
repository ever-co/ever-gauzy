import {
	Controller,
	Get,
	HttpStatus,
	Query,
	Post,
	Body,
	HttpCode,
	Put,
	Param,
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController, PaginationParams } from './../core/crud';
import { OrganizationTeamService } from './organization-team.service';
import {
	IOrganizationTeam,
	IPagination
} from '@gauzy/contracts';
import { OrganizationTeam } from './organization-team.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CreateOrganizationTeamDTO, UpdateOrganizationTeamDTO } from './dto';

@ApiTags('OrganizationTeam')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationTeamController extends CrudController<OrganizationTeam> {
	constructor(
		private readonly organizationTeamService: OrganizationTeamService
	) {
		super(organizationTeamService);
	}

	/**
	 * GET find my organization teams
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all organization Teams.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Teams',
		type: OrganizationTeam
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('me')
	async findMyTeams(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganizationTeam>> {
		const { relations, findInput, employeeId } = data;
		return this.organizationTeamService.findMyTeams(
			relations,
			findInput,
			employeeId
		);
	}

	/**
	 * CREATE organization team
	 * 
	 * @param entity 
	 * @param options 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/create')
	@UsePipes( new ValidationPipe({ transform : true }))
	async createOrganizationTeam(
		@Body() body: CreateOrganizationTeamDTO,
		...options: any[]
	): Promise<OrganizationTeam> {
		return this.organizationTeamService.createOrgTeam(body);
	}

	/**
	 * Get pagination data of organization team
	 * 
	 * @param id 
	 * @param entity 
	 * @returns 
	 */
	 @Get('pagination')
	 @UsePipes(new ValidationPipe({ transform: true }))
	 async pagination(
		 @Query() filter: PaginationParams<IOrganizationTeam>
	 ): Promise<IPagination<IOrganizationTeam>> {
		 return this.organizationTeamService.pagination(filter);
	 }

	/**
	 * GET all organization teams
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all organization Teams.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Teams',
		type: OrganizationTeam
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganizationTeam>> {
		const { relations, findInput } = data;
		return this.organizationTeamService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * UPDATE organization team by id
	 * 
	 * @param id 
	 * @param entity 
	 * @param options 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Update an organization Team' })
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
	@UsePipes( new ValidationPipe( { transform : true }))
	async updateOrganizationTeam(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: UpdateOrganizationTeamDTO,
		...options: any[]
	): Promise<OrganizationTeam> {
		return this.organizationTeamService.updateOrgTeam(id, body);
	}
}
