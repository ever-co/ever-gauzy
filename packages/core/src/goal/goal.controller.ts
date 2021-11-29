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
import { DeleteResult } from 'typeorm';
import { IGoal, IPagination } from '@gauzy/contracts';
import { GoalService } from './goal.service';
import { Goal } from './goal.entity';
import { CrudController } from './../core/crud';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('Goals')
@UseGuards(TenantPermissionGuard)
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
	@Post()
	async create(
		@Body() entity: Goal
	): Promise<IGoal> {
		return this.goalService.create(entity);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IGoal>> {
		const { relations, findInput } = data;
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
	async update(
		@Param('id', UUIDValidationPipe) id: string, 
		@Body() entity: Goal
	): Promise<IGoal> {
		try {
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this.goalService.create({
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
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<DeleteResult> {
		return this.goalService.delete(id);
	}
}
