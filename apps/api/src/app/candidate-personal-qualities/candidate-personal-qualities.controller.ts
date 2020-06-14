import {
	Controller,
	UseGuards,
	Post,
	Body,
	Delete,
	Param,
	Query,
	HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../shared/guards/auth/role.guard';
import { Roles } from '../shared/decorators/roles';
import { RolesEnum, ICandidatePersonalQualities } from '@gauzy/models';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CandidatePersonalQualitiesService } from './candidate-personal-qualities.service';
import { ParseJsonPipe } from '../shared';
import {
	CandidatePersonalQualitiesBulkCreateCommand,
	CandidatePersonalQualitiesBulkDeleteCommand
} from './commands';
import { CommandBus } from '@nestjs/cqrs';

@ApiTags('candidate_personal_quality')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidatePersonalQualitiesController extends CrudController<
	CandidatePersonalQualities
> {
	constructor(
		private readonly candidatePersonalQualitiesService: CandidatePersonalQualitiesService,
		private commandBus: CommandBus
	) {
		super(candidatePersonalQualitiesService);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post()
	async addPersonalQuality(
		@Body() entity: CandidatePersonalQualities
	): Promise<any> {
		return this.candidatePersonalQualitiesService.create(entity);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete(':id')
	deletePersonalQuality(@Param() id: string): Promise<any> {
		return this.candidatePersonalQualitiesService.delete(id);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post('createBulk')
	async createBulk(
		@Body() input: any
	): Promise<ICandidatePersonalQualities[]> {
		const { interviewId = null, personalQualities = [] } = input;
		return this.commandBus.execute(
			new CandidatePersonalQualitiesBulkCreateCommand(
				interviewId,
				personalQualities
			)
		);
	}

	@ApiOperation({
		summary: 'Delete PersonalQualities By Interview Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate PersonalQualities',
		type: CandidatePersonalQualities
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	async deleteBulkPersonalQualities(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { id = null } = data;
		return this.commandBus.execute(
			new CandidatePersonalQualitiesBulkDeleteCommand(id)
		);
	}
}
