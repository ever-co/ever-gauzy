import {
	Controller,
	UseGuards,
	HttpStatus,
	Get,
	Body,
	Post,
	Query
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { IGoalTemplate, IPagination } from '@gauzy/contracts';
import { GoalTemplateService } from './goal-template.service';
import { CrudController } from './../core/crud';
import { GoalTemplate } from './goal-template.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';

@ApiTags('GoalTemplates')
@UseGuards(TenantPermissionGuard)
@Controller()
export class GoalTemplateController extends CrudController<GoalTemplate> {

	constructor(
		private readonly goalTemplateService: GoalTemplateService
	) {
		super(goalTemplateService);
	}

	/**
	 * GET all goal templates
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find goal templates.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found goal templates',
		type: GoalTemplate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IGoalTemplate>> {
		const { findInput } = data;
		return this.goalTemplateService.findAll({
			relations: ['keyResults', 'keyResults.kpi'],
			where: { ...findInput }
		});
	}

	/**
	 * CREATE goal template
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Create Goal Template' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Goal Template Created successfully',
		type: GoalTemplate
	})
	@Post()
	async create(
		@Body() entity: GoalTemplate
	): Promise<IGoalTemplate> {
		return this.goalTemplateService.create(entity);
	}
}
