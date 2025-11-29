import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IEmployeeRecentVisit, IPagination } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UseValidationPipe } from '../shared/pipes';
import { EmployeeRecentVisitService } from './employee-recent-visit.service';
import { GetEmployeeRecentVisitsDTO } from './dto/get-employee-recent-visits.dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions()
@Controller('/employee-recent-visit')
export class EmployeeRecentVisitController {
	constructor(private readonly _employeeRecentVisitService: EmployeeRecentVisitService) {}

	/**
	 * Retrieves employee recent visits based on query parameters.
	 * Supports filtering, pagination, sorting, and ordering.
	 *
	 * @param query Query parameters for filtering, pagination, and ordering.
	 * @returns A list of employee recent visits.
	 */
	@Get('/')
	@UseValidationPipe({ transform: true })
	async getEmployeeRecentVisits(
		@Query() query: GetEmployeeRecentVisitsDTO
	): Promise<IPagination<IEmployeeRecentVisit>> {
		return await this._employeeRecentVisitService.findEmployeeRecentVisits(query);
	}
}
