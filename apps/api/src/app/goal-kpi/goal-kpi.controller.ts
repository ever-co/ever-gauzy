import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	Param,
	Delete,
	HttpCode,
	Put
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrudController } from '../core';
import { GoalKPI } from './goal-kpi.entity';
import { GoalKpiService } from './goal-kpi.service';

@ApiTags('goal-kpi')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class GoalKpiController extends CrudController<GoalKPI> {
	constructor(private readonly goalKpiService: GoalKpiService) {
		super(goalKpiService);
	}

	@ApiOperation({ summary: 'Create Goal KPI' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'KPI added successfully',
		type: GoalKPI
	})
	@Post('/create')
	async createGoal(@Body() entity: GoalKPI): Promise<any> {
		return this.goalKpiService.create(entity);
	}

	@ApiOperation({ summary: 'Get all KPI' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found all KPI'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No KPI found'
	})
	@Get('all')
	async getAll(@Query('data') data: string) {
		const { findInput } = JSON.parse(data);
		return this.goalKpiService.findAll({
			where: { ...findInput },
			relations: ['lead']
		});
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async deleteKPI(@Param('id') id: string): Promise<any> {
		return this.goalKpiService.delete(id);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: GoalKPI
	): Promise<GoalKPI> {
		try {
			return await this.goalKpiService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}
}
