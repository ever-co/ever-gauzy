import { Controller, HttpStatus, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GoalService } from './goal.service';
import { Goal } from './goal.entity';
import { CrudController } from '../core';

@ApiTags('Goals')
@Controller()
export class GoalController extends CrudController<Goal> {
	constructor(private readonly goalService: GoalService) {
		super(goalService);
	}

	@ApiOperation({ summary: 'Find all policies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	getAll() {
		return 'Helloo';
	}
}
