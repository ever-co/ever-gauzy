import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrudController } from '../core';
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { GoalKpiTemplateService } from './goal-kpi-template.service';

@ApiTags('GoalKpiTemplate')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class GoalKpiTemplateController extends CrudController<GoalKPITemplate> {
	constructor(
		private readonly goalKpiTemplateService: GoalKpiTemplateService
	) {
		super(goalKpiTemplateService);
	}

	@ApiOperation({ summary: 'Create Goal Template' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Goal Template Created successfully',
		type: GoalKPITemplate
	})
	@Post('/create')
	async createGoalKPITemplate(@Body() entity: GoalKPITemplate): Promise<any> {
		return this.goalKpiTemplateService.create(entity);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('all')
	async getAll() {
		return this.goalKpiTemplateService.findAll();
	}
}
