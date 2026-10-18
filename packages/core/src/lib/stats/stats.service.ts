import { Injectable, Logger } from '@nestjs/common';
import { EmployeeKindEnum } from '@gauzy/contracts';
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

/** How long (ms) the global statistics are reused when `STATS_GLOBAL_TTL_MS` is not set. */
export const DEFAULT_GLOBAL_STATS_TTL_MS = 5 * 60 * 1000;

/**
 * The reuse window of the global statistics, from `STATS_GLOBAL_TTL_MS`: milliseconds, `0` / `false` / `off` to
 * compute them on every call, anything unreadable the default.
 *
 * @param value The setting's raw value (the environment variable by default).
 * @returns The window in milliseconds; `0` disables the reuse.
 */
export function resolveGlobalStatsTtlMs(value: string | undefined = process.env.STATS_GLOBAL_TTL_MS): number {
	if (value === undefined || value === null || value.trim() === '') {
		return DEFAULT_GLOBAL_STATS_TTL_MS;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === 'false' || normalized === 'off' || normalized === 'no') {
		return 0;
	}
	const parsed = Number(normalized);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return DEFAULT_GLOBAL_STATS_TTL_MS;
	}
	return Math.floor(parsed);
}

@Injectable()
export class StatsService {
	private readonly logger = new Logger(StatsService.name);

	/**
	 * The reuse window. `/stats/global` is public (behind its feature flag) and answers nine aggregate statements
	 * over the whole database — every tenant's employees, tasks, organizations, teams, invoices, payments, users
	 * and the sum of every time log ever (1.2 s on production). The figures move slowly; one computation per
	 * window serves every caller, and concurrent callers share the computation in flight.
	 */
	private readonly ttlMs = resolveGlobalStatsTtlMs();
	private cached?: { stats: GlobalStats; expiresAt: number };
	private computing?: Promise<GlobalStats>;

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
		if (this.ttlMs > 0 && this.cached && this.cached.expiresAt > Date.now()) {
			return this.cached.stats;
		}
		if (!this.computing) {
			this.computing = this.computeGlobalStats()
				.then((stats) => {
					if (this.ttlMs > 0) {
						this.cached = { stats, expiresAt: Date.now() + this.ttlMs };
					}
					return stats;
				})
				.finally(() => {
					this.computing = undefined;
				});
		}
		return this.computing;
	}

	/**
	 * Computes the global statistics from the database (see {@link getGlobalStats} for the reuse around it).
	 *
	 * @returns The global statistics.
	 */
	private async computeGlobalStats(): Promise<GlobalStats> {
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
				userStats,
				totalTrackedTime
			] = await Promise.all([
				this._employeeService.count({ where: { kind: EmployeeKindEnum.HUMAN } }), // Count the employees (people, not agent employees)
				this._taskService.count(), // Count the number of tasks
				this._organizationService.count(), // Count the number of organizations
				this._organizationTeamService.count(), // Count the number of teams
				this._tenantService.count(), // Count the number of tenants
				this._invoiceService.getInvoiceStats(), // Get invoice stats
				this._paymentService.getPaymentStats(), // Get payment stats
				this._userService.getUserStats(), // Total users and last month’s active users
				this._statisticService.getOverallTrackedTime() // Fetch the overall tracked time
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
				users: userStats,
				hours: totalTrackedTime
			};
		} catch (error) {
			// Log the error and throw a custom error message
			this.logger.error(`Error fetching global stats: ${error?.message ?? error}`, error?.stack);
			throw new Error(`Failed to retrieve global statistics: ${error.message}`);
		}
	}
}
