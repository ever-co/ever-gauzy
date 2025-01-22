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
	Put,
	BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IKPI, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { GoalKPI } from './goal-kpi.entity';
import { GoalKpiService } from './goal-kpi.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('GoalKpi')
@UseGuards(TenantPermissionGuard)
@Controller('/goal-kpi')
export class GoalKpiController extends CrudController<GoalKPI> {
	constructor(private readonly goalKpiService: GoalKpiService) {
		super(goalKpiService);
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
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IKPI>> {
		const { findInput } = data;
		return this.goalKpiService.findAll({
			where: { ...findInput },
			relations: ['lead']
		});
	}

	@ApiOperation({ summary: 'Create Goal KPI' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'KPI added successfully',
		type: GoalKPI
	})
	@Post()
	async create(@Body() entity: GoalKPI): Promise<IKPI> {
		return this.goalKpiService.create(entity);
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
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: GoalKPI): Promise<IKPI> {
		try {
			return await this.goalKpiService.create({
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
		return this.goalKpiService.delete(id);
	}
}
