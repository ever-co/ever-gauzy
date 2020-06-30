import {
	Controller,
	HttpStatus,
	Get,
	Post,
	Body,
	HttpCode,
	Put,
	Param,
	UseGuards,
	Delete,
	Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GoalService } from './goal.service';
import { Goal } from './goal.entity';
import { CrudController } from '../core';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Goals')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class GoalController extends CrudController<Goal> {
	constructor(private readonly goalService: GoalService) {
		super(goalService);
	}

	@ApiOperation({ summary: 'Create Goal' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Goal Created successfully',
		type: Goal
	})
	@Post('/create')
	async createGoal(@Body() entity: Goal): Promise<any> {
		return this.goalService.create(entity);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('all')
	async getAll(@Query('data') data: string) {
		const { relations, findInput } = JSON.parse(data);
		return this.goalService.findAll({
			where: { ...findInput },
			relations,
			order: { createdAt: 'ASC' }
		});
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
	async update(@Param('id') id: string, @Body() entity: Goal): Promise<Goal> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return this.goalService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async deleteGoal(@Param('id') id: string): Promise<any> {
		return this.goalService.delete(id);
	}
}
