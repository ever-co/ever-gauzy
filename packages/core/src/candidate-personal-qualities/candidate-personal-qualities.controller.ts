import {
	Controller,
	UseGuards,
	Post,
	Body,
	Delete,
	Param,
	Get,
	Query,
	HttpStatus
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus } from '@nestjs/cqrs';
import {
	RolesEnum,
	ICandidatePersonalQualities,
	IPagination,
	ICandidatePersonalQualitiesCreateInput
} from '@gauzy/contracts';
import { CrudController } from '../core/crud';
import { RoleGuard, TenantPermissionGuard } from './../shared/guards';
import { Roles } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CandidatePersonalQualitiesService } from './candidate-personal-qualities.service';
import {
	CandidatePersonalQualitiesBulkCreateCommand,
	CandidatePersonalQualitiesBulkDeleteCommand
} from './commands';

@ApiTags('CandidatePersonalQuality')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CandidatePersonalQualitiesController extends CrudController<CandidatePersonalQualities> {
	constructor(
		private readonly candidatePersonalQualitiesService: CandidatePersonalQualitiesService,
		private readonly commandBus: CommandBus
	) {
		super(candidatePersonalQualitiesService);
	}

	/**
	 * GET candidate personal qualities by interview id
	 * 
	 * @param interviewId 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Get('interview/:interviewId')
	async findByInterviewId(
		@Param('interviewId', UUIDValidationPipe) interviewId: string
	): Promise<ICandidatePersonalQualities[]> {
		return this.candidatePersonalQualitiesService.getPersonalQualitiesByInterviewId(
			interviewId
		);
	}

	/**
	 * DELETE bulk candidate personal qualities by id
	 * 
	 * @param id 
	 * @param data 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete('bulk/:id')
	async deleteBulk(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { personalQualities = null } = data;
		return this.commandBus.execute(
			new CandidatePersonalQualitiesBulkDeleteCommand(
				id,
				personalQualities
			)
		);
	}

	/**
	 * CREATE bulk candidate personal qualities
	 * 
	 * @param body 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post('bulk')
	async createBulk(
		@Body() body: any
	): Promise<ICandidatePersonalQualities[]> {
		const { interviewId = null, personalQualities = [] } = body;
		return this.commandBus.execute(
			new CandidatePersonalQualitiesBulkCreateCommand(
				interviewId,
				personalQualities
			)
		);
	}

	/**
	 * GET all candidate personal qualities
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find all candidate personal qualities.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate personal qualities',
		type: CandidatePersonalQualities
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
	): Promise<IPagination<ICandidatePersonalQualities>> {
		const { findInput, relations } = data;
		return this.candidatePersonalQualitiesService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE candidate personal quality
	 * 
	 * @param data 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post()
	async create(
		@Body() data: ICandidatePersonalQualitiesCreateInput
	): Promise<ICandidatePersonalQualities> {
		return this.candidatePersonalQualitiesService.create(data);
	}

	/**
	 * DELETE candidate personal qualities by id
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
		return this.candidatePersonalQualitiesService.delete(id);
	}
}
