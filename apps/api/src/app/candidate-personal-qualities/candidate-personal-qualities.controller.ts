import {
	Controller,
	UseGuards,
	Post,
	Body,
	Delete,
	Param
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../shared/guards/auth/role.guard';
import { Roles } from '../shared/decorators/roles';
import { RolesEnum } from '@gauzy/models';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CandidatePersonalQualitiesService } from './candidate-personal-qualities.service';

@ApiTags('candidate_personal_qualities')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidatePersonalQualitiesController extends CrudController<
	CandidatePersonalQualities
> {
	constructor(
		private readonly candidatePersonalQualitiesService: CandidatePersonalQualitiesService
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
}
