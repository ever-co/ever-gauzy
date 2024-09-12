import { Injectable } from '@nestjs/common';
import { GlobalStats } from './stats.types';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationService } from '../organization/organization.service';
import { TenantService } from '../tenant/tenant.service';
import { UserService } from '../user/user.service';
import { TaskService } from '../tasks/task.service';
import { InvoiceService } from '../invoice/invoice.service';
import { PaymentService } from '../payment/payment.service';
import { StatisticService } from '../time-tracking/statistic/statistic.service';
import { OrganizationTeamService } from '../organization-team/organization-team.service';

@Injectable()
export class StatsService {
	constructor(
		readonly _employeeService: EmployeeService,
		readonly _organizationService: OrganizationService,
		readonly _organizationTeamService: OrganizationTeamService,
		readonly _tenantService: TenantService,
		readonly _userService: UserService,
		readonly _taskService: TaskService,
		readonly _invoiceService: InvoiceService,
		readonly _paymentService: PaymentService,
		readonly _statisticService: StatisticService
	) {}

	/**
	 * Retrieves global statistics including the number of tenants, users, employees, organizations,
	 * teams, invoice and payment statistics, overall tracked time, and more.
	 *
	 * This method aggregates various statistics from different services and returns them in a unified format.
	 *
	 * @returns {Promise<GlobalStats>} - A promise that resolves to an object containing global statistics.
	 * @throws {Error} - Throws an error if there is an issue fetching any of the statistics.
	 */
	async getGlobalStats(): Promise<GlobalStats> {
		try {
			// Fetch statistics from different services
			const [
				employeeCount,
				taskCount,
				organizationCount,
				teamCount,
				tenantCount,
				invoiceStats,
				paymentStats,
				totalTrackedTime,
				monthlyActiveUsers
			] = await Promise.all([
				this._employeeService.count(), // Count the number of employees
				this._taskService.count(), // Count the number of tasks
				this._organizationService.count(), // Count the number of organizations
				this._organizationTeamService.count(), // Count the number of teams
				this._tenantService.count(), // Count the number of tenants
				this._invoiceService.getInvoiceStats(), // Get invoice stats
				this._paymentService.getPaymentStats(), // Get payment stats
				this._statisticService.getOverallTrackedTime(), // Fetch the overall tracked time
				this._userService.getMonthlyActiveUsers() // Get the count of monthly active users
			]);

			// Return the global stats as an object
			return {
				employees: employeeCount,
				tasks: taskCount,
				organizations: organizationCount,
				teams: teamCount,
				tenants: tenantCount,
				invoices: invoiceStats,
				payments: paymentStats,
				hours: totalTrackedTime,
				users: monthlyActiveUsers
			};
		} catch (error) {
			// Log the error and throw a custom error message
			console.error('Error fetching global stats:', error);
			throw new Error(`Failed to retrieve global statistics: ${error.message}`);
		}
	}
}
