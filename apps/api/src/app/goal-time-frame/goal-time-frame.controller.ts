import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	HttpCode,
	Delete,
	Param,
	Put,
	Query
} from '@nestjs/common';
import { CrudController } from '../core';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GoalTimeFrameService } from './goal-time-frame.service';

@ApiTags('GoalTimeFrame')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class GoalTimeFrameController extends CrudController<GoalTimeFrame> {
	constructor(private readonly goalTimeFrameService: GoalTimeFrameService) {
		super(goalTimeFrameService);
	}

	@ApiOperation({ summary: 'Create Goal Time Frame' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Time Frame added successfully',
		type: GoalTimeFrame
	})
	@Post('/create')
	async createGoal(@Body() entity: GoalTimeFrame): Promise<any> {
		return this.goalTimeFrameService.create(entity);
	}

	@ApiOperation({ summary: 'Get all Goal Time Frames' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found all Time Frames'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Time Frame found'
	})
	@Get('all')
	async getAll(@Query('data') data: string) {
		const { findInput } = JSON.parse(data);
		return this.goalTimeFrameService.findAll({ where: { ...findInput } });
	}

	@ApiOperation({ summary: 'Find Goal Time Frames with name' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found all Time Frames'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Time Frame found'
	})
	@Get(':name')
	async getByName(@Param('name') name: string) {
		return this.goalTimeFrameService.findAll({ where: { name: name } });
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async deleteTask(@Param('id') id: string): Promise<any> {
		return this.goalTimeFrameService.delete(id);
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
		@Body() entity: GoalTimeFrame
	): Promise<GoalTimeFrame> {
		try {
			return await this.goalTimeFrameService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}
}
