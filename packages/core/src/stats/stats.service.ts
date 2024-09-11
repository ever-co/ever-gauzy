import { Injectable } from '@nestjs/common';
import { GlobalStats } from './stats.types';
import { TenantService } from '../tenant/tenant.service';
import { UserService } from '../user/user.service';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class StatsService {
	constructor(
		readonly _tenantService: TenantService,
		readonly _userService: UserService,
		readonly _employeeService: EmployeeService,
		readonly _organizationService: OrganizationService
	) {}

	/**
	 * Get global stats
	 *
	 * This method fetches and returns global statistics including the number of tenants
	 * and users. It also provides an opportunity to add more statistics in the future.
	 *
	 * @returns {Promise<GlobalStats>} - A promise that resolves to an object containing global stats
	 * @throws {Error} - Throws an error if there is an issue fetching the data
	 */
	async getGlobalStats(): Promise<GlobalStats> {
		try {
			const tenants = await this._tenantService.count(); // Count the number of tenants
			const users = await this._userService.getMonthlyActiveUsers(); // Get the count of monthly active users
			const employees = await this._employeeService.count(); // Count the number of employees
			const organizations = await this._organizationService.count(); // Count the number of organizations

			// Return the global stats as an object
			return {
				tenants,
				users,
				employees,
				organizations
				// Add more properties here as needed
			};
		} catch (error) {
			// Log the error and throw a custom error message
			console.error('Error fetching global stats:', error);
			throw new Error(`Failed to retrieve global statistics: ${error.message}`);
		}
	}
}
