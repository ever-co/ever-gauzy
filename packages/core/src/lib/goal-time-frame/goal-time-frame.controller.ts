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
	Query,
	BadRequestException
} from '@nestjs/common';
import { IGoalTimeFrame, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GoalTimeFrameService } from './goal-time-frame.service';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { CreateGoalTimeFrameDTO, UpdateGoalTimeFrameDTO } from './dto';

@ApiTags('GoalTimeFrame')
@UseGuards(TenantPermissionGuard)
@Controller('/goal-time-frame')
export class GoalTimeFrameController extends CrudController<GoalTimeFrame> {
	constructor(private readonly goalTimeFrameService: GoalTimeFrameService) {
		super(goalTimeFrameService);
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
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IGoalTimeFrame>> {
		const { findInput } = data;
		return this.goalTimeFrameService.findAll({
			where: { ...findInput }
		});
	}

	@ApiOperation({ summary: 'Create Goal Time Frame' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Time Frame added successfully',
		type: GoalTimeFrame
	})
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateGoalTimeFrameDTO): Promise<IGoalTimeFrame> {
		return this.goalTimeFrameService.create(entity);
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
	async getByName(@Param('name') name: string): Promise<IPagination<IGoalTimeFrame>> {
		return this.goalTimeFrameService.findAll({ where: { name: name } });
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateGoalTimeFrameDTO
	): Promise<IGoalTimeFrame> {
		try {
			return await this.goalTimeFrameService.create({
				id,
				...entity
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.goalTimeFrameService.delete(id);
	}
}
