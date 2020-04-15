import {
	Controller,
	HttpStatus,
	Get,
	Query,
	HttpCode,
	Put,
	Param,
	Body,
	BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Task } from './task.entity';
import { CrudController, IPagination } from '../core';
import { TaskService } from './task.service';

@ApiTags('Tasks')
@Controller()
export class TaskController extends CrudController<Task> {
	constructor(private readonly taskService: TaskService) {
		super(taskService);
	}

	@ApiOperation({ summary: 'Find all policies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: Task
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllTimeOffPolicies(
		@Query('data') data: string
	): Promise<IPagination<Task>> {
		const { relations, findInput } = JSON.parse(data);

		return this.taskService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Update an existing task' })
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
	async update(@Param('id') id: string, @Body() entity: Task): Promise<any> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return this.taskService.create({
				id,
				...entity
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
