import {
	Controller,
	UseGuards,
	HttpStatus,
	Get,
	Body,
	Post
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GoalTemplateService } from './goal-template.service';
import { CrudController } from '../core';
import { GoalTemplate } from './goal-template.entity';

@ApiTags('GoalTemplates')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class GoalTemplateController extends CrudController<GoalTemplate> {
	constructor(private readonly goalTemplateService: GoalTemplateService) {
		super(goalTemplateService);
	}

	@ApiOperation({ summary: 'Create Goal Template' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Goal Template Created successfully',
		type: GoalTemplate
	})
	@Post('/create')
	async createGoalTemplate(@Body() entity: GoalTemplate): Promise<any> {
		return this.goalTemplateService.create(entity);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('all')
	async getAll() {
		return this.goalTemplateService.findAll({ relations: ['keyResults'] });
	}
}
