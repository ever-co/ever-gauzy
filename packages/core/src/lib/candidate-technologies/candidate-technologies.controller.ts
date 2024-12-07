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
import { CommandBus } from '@nestjs/cqrs';
import { RolesEnum, ICandidateTechnologies, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { RoleGuard, TenantPermissionGuard } from './../shared/guards';
import { Roles } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CandidateTechnologiesService } from './candidate-technologies.service';
import { CandidateTechnologies } from './candidate-technologies.entity';
import {
	CandidateTechnologiesBulkCreateCommand,
	CandidateTechnologiesBulkDeleteCommand,
	CandidateTechnologiesBulkUpdateCommand
} from './commands';

@ApiTags('CandidateTechnology')
@UseGuards(TenantPermissionGuard)
@Controller()
export class CandidateTechnologiesController extends CrudController<CandidateTechnologies> {
	constructor(
		private readonly candidateTechnologiesService: CandidateTechnologiesService,
		private readonly commandBus: CommandBus
	) {
		super(candidateTechnologiesService);
	}

	/**
	 * CREATE bulk candidate technologies
	 * 
	 * @param body 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post('bulk')
	async createBulkCandidateTechnoglies(
		@Body() body: any
	): Promise<ICandidateTechnologies[]> {
		const { interviewId = null, technologies = [] } = body;
		return await this.commandBus.execute(
			new CandidateTechnologiesBulkCreateCommand(
				interviewId,
				technologies
			)
		);
	}

	/**
	 * UPDATE bulk candidate technologies
	 * 
	 * @param body 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Put('bulk')
	async updateBulkCandidateTechnoglies(
		@Body() body: ICandidateTechnologies[]
	): Promise<ICandidateTechnologies[]> {
		return await this.commandBus.execute(
			new CandidateTechnologiesBulkUpdateCommand(body)
		);
	}

	/**
	 * GET candidate technology by feedback id
	 * 
	 * @param interviewId 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Get('interview/:interviewId')
	async findByInterviewId(
		@Param('interviewId', UUIDValidationPipe) interviewId: string
	): Promise<ICandidateTechnologies[]> {
		return await this.candidateTechnologiesService.getTechnologiesByInterviewId(
			interviewId
		);
	}

	/**
	 * DELETE bulk candidate technology by id
	 * 
	 * @param id 
	 * @param data 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete('bulk/:id')
	async deleteBulkTechnologies(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { technologies = null } = data;
		return await this.commandBus.execute(
			new CandidateTechnologiesBulkDeleteCommand(id, technologies)
		);
	}

	/**
	 * GET all candidate technologies
	 * 
	 * @param data 
	 * @returns 
	 */
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
	findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidateTechnologies>> {
		const { findInput, relations } = data;
		return this.candidateTechnologiesService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE candidate technologies
	 * 
	 * @param body 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post()
	async create(
		@Body() body: CandidateTechnologies
	): Promise<ICandidateTechnologies> {
		return this.candidateTechnologiesService.create(body);
	}

	/**
	 * DELETE candidate technologies by id
	 * 
	 * @param id 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete(':id')
	delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<any> {
		return this.candidateTechnologiesService.delete(id);
	}
}
