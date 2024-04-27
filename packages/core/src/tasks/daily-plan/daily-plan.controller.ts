import { Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, PaginationParams } from '../../core/crud';
import { DailyPlan } from './daily-plan.entity';
import { DailyPlanService } from './daily-plan.service';
import { IEmployee } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';

@ApiTags('Daily Plan')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller()
export class DailyPlanController extends CrudController<DailyPlan> {
	constructor(private readonly dailyPlanService: DailyPlanService) {
		super(dailyPlanService);
	}

	/**
	 * GET daily plans for a given employee
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find employee daily plans.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found plans',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Record found'
	})
	@Get(':id')
	async getEmployeeDailyPlans(
		@Param('id') employeeId: IEmployee['id'],
		@Query() params: PaginationParams<DailyPlan>
	) {
		return await this.dailyPlanService.getDailyPlansByEmployee(employeeId, params);
	}
}
