import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	HttpCode,
	Put,
	Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrudController } from '../core';
import { GoalGeneralSetting } from './goal-general-setting.entity';
import { GoalGeneralSettingService } from './goal-general-setting.service';
import { Goal } from '../goal/goal.entity';

@ApiTags('goal-general-setting')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class GoalGeneralSettingController extends CrudController<
	GoalGeneralSetting
> {
	constructor(
		private readonly goalGeneralSettingService: GoalGeneralSettingService
	) {
		super(goalGeneralSettingService);
	}

	@ApiOperation({ summary: 'Create Goal General Setting' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Goal general setting Created successfully',
		type: GoalGeneralSetting
	})
	@Post('/create')
	async createGoal(@Body() entity: Goal): Promise<any> {
		return this.goalGeneralSettingService.create(entity);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('all')
	async getAll(@Query('data') data: string) {
		const { findInput } = JSON.parse(data);
		return this.goalGeneralSettingService.findAll({
			where: { ...findInput }
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
	async update(
		@Param('id') id: string,
		@Body() entity: GoalGeneralSetting
	): Promise<GoalGeneralSetting> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return await this.goalGeneralSettingService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}
}
