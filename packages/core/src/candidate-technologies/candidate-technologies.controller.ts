import {
	Controller,
	UseGuards,
	Post,
	Body,
	Delete,
	Param,
	Get,
	Put,
	Query,
	HttpStatus
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../shared/guards/auth/role.guard';
import { Roles } from '../shared/decorators/roles';
import { RolesEnum, ICandidateTechnologies } from '@gauzy/contracts';
import { CandidateTechnologiesService } from './candidate-technologies.service';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { CommandBus } from '@nestjs/cqrs';
import {
	CandidateTechnologiesBulkCreateCommand,
	CandidateTechnologiesBulkDeleteCommand,
	CandidateTechnologiesBulkUpdateCommand
} from './commands';
import { ParseJsonPipe } from '../shared';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
@ApiTags('CandidateTechnology')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CandidateTechnologiesController extends CrudController<CandidateTechnologies> {
	constructor(
		private readonly candidateTechnologiesService: CandidateTechnologiesService,
		private commandBus: CommandBus
	) {
		super(candidateTechnologiesService);
	}

	@ApiOperation({ summary: 'Find all candidate technologies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate technologies',
		type: CandidateTechnologies
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Get()
	findAllApprovalPolicies(@Query('data') data: string): any {
		const { findInput, relations } = JSON.parse(data);
		return this.candidateTechnologiesService.findAll({
			where: findInput,
			relations
		});
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post()
	async addTechnology(@Body() entity: CandidateTechnologies): Promise<any> {
		return this.candidateTechnologiesService.create(entity);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete(':id')
	deleteTechnology(@Param() id: string): Promise<any> {
		return this.candidateTechnologiesService.delete(id);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post('createBulk')
	async createBulk(@Body() input: any): Promise<ICandidateTechnologies[]> {
		const { interviewId = null, technologies = [] } = input;
		return this.commandBus.execute(
			new CandidateTechnologiesBulkCreateCommand(
				interviewId,
				technologies
			)
		);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Put('updateBulk')
	async updateBulk(
		@Body() technologies: ICandidateTechnologies[]
	): Promise<ICandidateTechnologies[]> {
		return this.commandBus.execute(
			new CandidateTechnologiesBulkUpdateCommand(technologies)
		);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Get('getByInterviewId/:interviewId')
	async findByInterviewId(
		@Param('interviewId') interviewId: string
	): Promise<ICandidateTechnologies[]> {
		return this.candidateTechnologiesService.getTechnologiesByInterviewId(
			interviewId
		);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete('deleteBulk/:id')
	async deleteBulkTechnologies(
		@Param() id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { technologies = null } = data;
		return this.commandBus.execute(
			new CandidateTechnologiesBulkDeleteCommand(id, technologies)
		);
	}
}
