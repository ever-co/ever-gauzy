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
import { RolesEnum, ICandidateTechnologies } from '@gauzy/models';
import { CandidateTechnologiesService } from './candidate-technologies.service';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { CommandBus } from '@nestjs/cqrs';
import { ParseJsonPipe } from '../shared';
import {
	CandidateTechnologiesBulkCreateCommand,
	CandidateTechnologiesBulkDeleteCommand
} from './commands';
@ApiTags('candidate_technology')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateTechnologiesController extends CrudController<
	CandidateTechnologies
> {
	constructor(
		private readonly candidateTechnologiesService: CandidateTechnologiesService,
		private commandBus: CommandBus
	) {
		super(candidateTechnologiesService);
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

	@ApiOperation({ summary: 'Create Technologies in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Technologies have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
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

	@ApiOperation({
		summary: 'Delete Technologies By Interview Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Deleted candidate Technologies',
		type: CandidateTechnologies
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Delete('deleteBulk')
	async deleteBulk(@Query('data', ParseJsonPipe) data: any): Promise<any> {
		const { id = null } = data;
		return this.commandBus.execute(
			new CandidateTechnologiesBulkDeleteCommand(id)
		);
	}
}
