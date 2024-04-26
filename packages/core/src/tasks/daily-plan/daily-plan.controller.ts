import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, PaginationParams } from '../../core/crud';
import { DailyPlan } from './daily-plan.entity';
import { DailyPlanService } from './daily-plan.service';
import { IDailyPlan, IPagination } from '@gauzy/contracts';

// @UseGuards(TenantPermissionGuard)
@ApiTags('Daily Plan')
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
	@Get()
	async getEmployeeDailyPlans(@Query() params: PaginationParams<DailyPlan>): Promise<IPagination<IDailyPlan>> {
		return await this.dailyPlanService.getEmployeeDailyPlans(params);
	}
}
