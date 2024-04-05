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
	Param,
	BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IGoalGeneralSetting, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { GoalGeneralSetting } from './goal-general-setting.entity';
import { GoalGeneralSettingService } from './goal-general-setting.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateGoalGeneralSettingDTO, UpdateGoalGeneralSettingDTO } from './dto';

@ApiTags('GoalGeneralSetting')
@UseGuards(TenantPermissionGuard)
@Controller()
export class GoalGeneralSettingController extends CrudController<GoalGeneralSetting> {
	constructor(
		private readonly goalGeneralSettingService: GoalGeneralSettingService
	) {
		super(goalGeneralSettingService);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IGoalGeneralSetting>> {
		const { findInput = null } = data;
		return this.goalGeneralSettingService.findAll({
			where: { ...findInput }
		});
	}

	@ApiOperation({ summary: 'Create Goal General Setting' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Goal general setting Created successfully',
		type: GoalGeneralSetting
	})
	@Post()
	@UseValidationPipe({ transform: true })
	async create(
		@Body() entity: CreateGoalGeneralSettingDTO
	): Promise<IGoalGeneralSetting> {
		return this.goalGeneralSettingService.create(entity);
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
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateGoalGeneralSettingDTO
	): Promise<IGoalGeneralSetting> {
		try {
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this.goalGeneralSettingService.create({
				id,
				...entity
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
