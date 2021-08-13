import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IGoalKPITemplate, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { GoalKpiTemplateService } from './goal-kpi-template.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';

@ApiTags('GoalKpiTemplate')
@UseGuards(TenantPermissionGuard)
@Controller()
export class GoalKpiTemplateController extends CrudController<GoalKPITemplate> {
	constructor(
		private readonly goalKpiTemplateService: GoalKpiTemplateService
	) {
		super(goalKpiTemplateService);
	}

	@ApiOperation({ summary: 'Find all goal kpi templates.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found goal kpi templates',
		type: GoalKPITemplate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IGoalKPITemplate>> {
		const { relations, findInput } = data;
		return this.goalKpiTemplateService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Create Goal Template' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Goal Template Created successfully',
		type: GoalKPITemplate
	})
	@Post()
	async create(
		@Body() entity: GoalKPITemplate
	): Promise<IGoalKPITemplate> {
		return this.goalKpiTemplateService.create(entity);
	}	
}
