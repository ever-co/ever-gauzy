import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
	ID,
	IGetTimeLogReportInput,
	IPublicSavedReport,
	IReportDayGroupByDate,
	ISavedReportFilters,
	PermissionsEnum,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { IAuthenticatedUser } from '../core/context/types';
import { RequestContext } from '../core/context/request-context';
import { MultiORMEnum, getORMType } from '../core/utils';
import { Employee, Organization, OrganizationProject, UserOrganization } from '../core/entities/internal';
import { isDeactivatedEmployee } from '../auth/deactivated-employee';
import { ManagedEmployeeService } from '../employee/managed-employee.service';
import { RoleAuthorizationService } from '../role/role-authorization.service';
import { canViewTrackedData } from '../shared/guards/employee-tracked-data.guard';
import { TimeLogService } from '../time-tracking/time-log/time-log.service';
import { UserService } from '../user/user.service';
import { MikroOrmSavedReportRepository } from './repository/mikro-orm-saved-report.repository';
import { TypeOrmSavedReportRepository } from './repository/type-orm-saved-report.repository';
import { SavedReport } from './saved-report.entity';
import { resolveSavedReportPeriod, weekStartDayOf } from './saved-report-period';
import {
	ISavedReportRate,
	keepPickedClients,
	memberIdsOf,
	projectIdsOf,
	ProjectClients,
	publicDaysOf,
	publicTotalsOf
} from './saved-report-public';
import { isSavedReportLinkLive } from './saved-report.rules';
import { hashSavedReportToken, isWellFormedSavedReportToken, savedReportTokenHashesMatch } from './saved-report-token';

/** The permissions the time log reports are read with: holding any of them lets a link be read. */
const REPORT_READ_PERMISSIONS = [
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ALL_ORG_EDIT,
	PermissionsEnum.ALL_ORG_VIEW
];

/** Every activity level, as the report page asks: the same logs as with no activity filter. */
const EVERY_ACTIVITY_LEVEL = { start: 0, end: 100 };

/** The one answer for every link that does not open a report, whatever the reason. */
function linkDoesNotWork(): NotFoundException {
	return new NotFoundException('This report link does not work.');
}

/**
 * Reads a saved report through its link, without a session.
 *
 * The report is computed when the link is opened, with the query of the report page
 * (`GET /timesheet/time-log/report/daily`) and the author's access as it is at that moment: their account, their
 * membership of the organization, their employee record, their role's permissions and the organization's rule on
 * seeing tracked data are read again at every opening, as a sign-in would read them. So a link never shows more than
 * its author may see, and stops working when the author left the organization or lost access.
 *
 * Every refusal (unknown, malformed, expired or turned-off link, author gone) is the same 404, so a link that never
 * existed cannot be told from one that was turned off. The answer holds report fields only (see `publicDaysOf`).
 */
@Injectable()
export class SavedReportPublicService {
	private readonly logger = new Logger(SavedReportPublicService.name);

	constructor(
		private readonly typeOrmSavedReportRepository: TypeOrmSavedReportRepository,
		private readonly mikroOrmSavedReportRepository: MikroOrmSavedReportRepository,
		private readonly dataSource: DataSource,
		private readonly userService: UserService,
		private readonly roleAuthorizationService: RoleAuthorizationService,
		private readonly timeLogService: TimeLogService,
		private readonly managedEmployeeService: ManagedEmployeeService
	) {}

	/**
	 * The report a link opens, computed now.
	 *
	 * @param token The token the link carries.
	 * @throws NotFoundException for any link that does not open a report.
	 */
	async read(token: string): Promise<IPublicSavedReport> {
		if (!isWellFormedSavedReportToken(token)) {
			throw linkDoesNotWork();
		}
		const presented = hashSavedReportToken(token);
		const report = await this.findByHash(presented);
		const now = new Date();
		const isOpen =
			!!report &&
			savedReportTokenHashesMatch(report.shareTokenHash, presented) &&
			isSavedReportLinkLive(report, now);
		if (!isOpen) {
			throw linkDoesNotWork();
		}

		const author = await this.authorAsTheyAreNow(report);
		if (!author) {
			this.logger.log(`Saved report link refused, its author no longer reads it: id=${report.id}`);
			throw linkDoesNotWork();
		}

		const request = { user: author, headers: {}, query: {}, params: {}, body: {} };
		return await RequestContext.runWithRequest(request as never, () => this.readAs(report, author, now));
	}

	/** The report with the author's context in place: the report page's checks, then its query. */
	private async readAs(report: SavedReport, author: IAuthenticatedUser, now: Date): Promise<IPublicSavedReport> {
		const mayReadReports = RequestContext.hasAnyPermission(REPORT_READ_PERMISSIONS);
		if (!mayReadReports) {
			throw linkDoesNotWork();
		}
		const mayViewTrackedData = await this.mayViewTrackedData(report.organizationId);
		if (!mayViewTrackedData) {
			throw linkDoesNotWork();
		}

		const organization = await this.dataSource.getRepository(Organization).findOne({
			where: { id: report.organizationId, tenantId: report.tenantId },
			select: { id: true, startWeekOn: true, currency: true }
		});
		if (!organization) {
			throw linkDoesNotWork();
		}
		const period = resolveSavedReportPeriod(report, weekStartDayOf(organization.startWeekOn), now);
		if (!period) {
			throw linkDoesNotWork();
		}

		const filters: ISavedReportFilters = report.filters ?? {};
		const teamIds = filters.teamIds ?? [];
		const request: IGetTimeLogReportInput = {
			tenantId: report.tenantId,
			organizationId: report.organizationId,
			startDate: period.start.toISOString(),
			endDate: period.end.toISOString(),
			timeZone: period.timeZone,
			groupBy: ReportGroupFilterEnum.date,
			employeeIds: await this.employeeIdsOf(filters, author),
			teamIds,
			projectIds: filters.projectIds ?? [],
			taskIds: filters.taskIds ?? [],
			activityLevel: EVERY_ACTIVITY_LEVEL,
			includeTimeWithoutTeam: teamIds.length > 0,
			billableOnly: filters.billableOnly === true
		};
		const days = ((await this.timeLogService.getDailyReport(request)) ?? []) as IReportDayGroupByDate[];

		const pickedClients = filters.clientIds ?? [];
		const projectClients = await this.projectClientsOf(pickedClients, days, report);
		const kept = keepPickedClients(days, pickedClients, projectClients);

		const rates = await this.ratesOf(report, kept, organization.currency);
		const publicDays = publicDaysOf(kept, rates);
		const includeAmounts = report.includeAmounts === true;

		return {
			name: report.name,
			kind: report.kind,
			grouping: report.grouping ?? null,
			includeAmounts,
			period: {
				rule: report.periodRule ?? null,
				startDate: period.startDate,
				endDate: period.endDate,
				timeZone: period.timeZone
			},
			generatedAt: now,
			days: publicDays,
			totals: publicTotalsOf(publicDays, includeAmounts)
		};
	}

	/**
	 * The author as a sign-in would see them now, in the report's organization: an active account of the report's tenant,
	 * an active membership of the organization, an employee record that was not ended, and their role's permissions.
	 * Null when any of these is gone.
	 */
	private async authorAsTheyAreNow(report: SavedReport): Promise<IAuthenticatedUser | null> {
		const user: IAuthenticatedUser = await this.userService.getIfExists(report.authorId);
		const isActiveAccount = !!user && user.isActive === true && user.isArchived !== true;
		const isSameTenant = !!user && user.tenantId === report.tenantId;
		if (!isActiveAccount || !isSameTenant) {
			return null;
		}

		const membership = await this.dataSource.getRepository(UserOrganization).findOne({
			where: {
				userId: user.id,
				organizationId: report.organizationId,
				tenantId: report.tenantId,
				isActive: true,
				isArchived: false
			},
			select: { id: true }
		});
		if (!membership) {
			return null;
		}

		const employees = await this.dataSource.getRepository(Employee).find({
			where: { userId: user.id, organizationId: report.organizationId, tenantId: report.tenantId },
			select: { id: true, isActive: true, isArchived: true }
		});
		if (isDeactivatedEmployee(employees)) {
			return null;
		}

		await this.roleAuthorizationService.attachAuthorizationState(user);
		const activeEmployee = employees.find((employee) => employee.isActive && !employee.isArchived);
		user.employeeId = activeEmployee?.id;
		user.lastOrganizationId = report.organizationId;
		return user;
	}

	/** The organization's rule on seeing tracked data, as `EmployeeTrackedDataGuard` applies it to the report page. */
	private async mayViewTrackedData(organizationId: ID): Promise<boolean> {
		try {
			return await canViewTrackedData(this.dataSource, [organizationId]);
		} catch {
			return false;
		}
	}

	/**
	 * The members the report reads, as the report page names them for its author: the picked ones (the query keeps them
	 * only if the author may read them all), else the members of the picked teams when the author, without the right to
	 * act for every employee, manages every one of those teams, else none (everyone the author may see: the query reads
	 * the author's own time for anyone who may not act for others).
	 */
	private async employeeIdsOf(filters: ISavedReportFilters, author: IAuthenticatedUser): Promise<ID[]> {
		const picked = filters.employeeIds ?? [];
		if (picked.length > 0) {
			return picked;
		}
		const teamIds = filters.teamIds ?? [];
		const actsForEveryEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		const hasOwnEmployee = !!author.employeeId;
		const mayNameTeamMembers = !actsForEveryEmployee && hasOwnEmployee && teamIds.length > 0;
		if (!mayNameTeamMembers) {
			return [];
		}
		for (const teamId of teamIds) {
			const managesTeam = await this.managedEmployeeService.managesAnyTeam(author.employeeId, [teamId]);
			if (!managesTeam) {
				return [];
			}
		}
		return await this.managedEmployeeService.findMembersOfReadableTeams(teamIds);
	}

	/** The client each project of the report names now, read only when clients are picked. */
	private async projectClientsOf(
		pickedClients: string[],
		days: IReportDayGroupByDate[],
		report: SavedReport
	): Promise<ProjectClients> {
		const projectIds = projectIdsOf(days);
		const needsClients = pickedClients.length > 0 && projectIds.length > 0;
		if (!needsClients) {
			return new Map();
		}
		const projects = await this.dataSource.getRepository(OrganizationProject).find({
			where: { id: In(projectIds), tenantId: report.tenantId, organizationId: report.organizationId },
			select: { id: true, organizationContactId: true }
		});
		return new Map(projects.map((project) => [project.id, project.organizationContactId ?? null]));
	}

	/**
	 * The rate of each member the report names, read now, when the author included amounts: a rate stated without a
	 * currency is in the organization's, as on the report page. Null when amounts are left out.
	 */
	private async ratesOf(
		report: SavedReport,
		days: IReportDayGroupByDate[],
		organizationCurrency: string | null | undefined
	): Promise<ReadonlyMap<ID, ISavedReportRate> | null> {
		if (report.includeAmounts !== true) {
			return null;
		}
		const memberIds = memberIdsOf(days);
		if (memberIds.length === 0) {
			return new Map();
		}
		const employees = await this.dataSource.getRepository(Employee).find({
			where: { id: In(memberIds), tenantId: report.tenantId },
			select: { id: true, billRateValue: true, billRateCurrency: true }
		});
		const rates = new Map<ID, ISavedReportRate>();
		for (const employee of employees) {
			const currency = employee.billRateCurrency || organizationCurrency || null;
			rates.set(employee.id, { billRateValue: employee.billRateValue ?? null, billRateCurrency: currency });
		}
		return rates;
	}

	/** Reads a report by its link's digest. Straight from the repository: the route has no session, the row its tenant. */
	private async findByHash(shareTokenHash: string): Promise<SavedReport | null> {
		switch (getORMType()) {
			case MultiORMEnum.MikroORM:
				return (await this.mikroOrmSavedReportRepository.findOne({ shareTokenHash })) as SavedReport | null;
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmSavedReportRepository.findOne({ where: { shareTokenHash } });
		}
	}
}
