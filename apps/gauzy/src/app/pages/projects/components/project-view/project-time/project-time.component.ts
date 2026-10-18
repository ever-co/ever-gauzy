import { ChangeDetectionStrategy, Component, inject, Input, OnChanges, type SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import {
	IActivitiesStatistics,
	IEmployee,
	IMembersStatistics,
	IOrganizationProject,
	ITimeSlot,
	OrganizationProjectBudgetTypeEnum,
	PermissionsEnum,
	TimeFormatEnum,
	TimeLogType
} from '@gauzy/contracts';
import { OrganizationProjectsService, Store, TimesheetService, TimesheetStatisticsService } from '@gauzy/ui-core/core';
import { ScreenshotsItemModule, TimeZoneService } from '@gauzy/ui-core/shared';
import {
	formatDuration,
	formatPercent,
	IPersonChip,
	Loadable,
	loaded,
	loading,
	failed,
	personOf,
	rangeLabelOf,
	statisticsRequest
} from '../project-view.utils';

/** One row of the heatmap: a person and their hours on each day of the period. */
interface IHeatmapRow {
	person: IPersonChip;
	/** Hours per day, aligned with the heatmap's days. */
	hours: number[];
	total: number;
}

interface IHeatmap {
	days: { label: string; long: string; weekend: boolean }[];
	rows: IHeatmapRow[];
	/** The busiest cell's hours, which the shading is measured against. */
	max: number;
}

/** One app or website and its time on the project in the period. */
interface IAppRow {
	title: string;
	duration: number;
	share: number;
	width: number;
}

/** One member's cost: their bill rate times their hours, in the period and since the project started. */
interface ICostRow {
	person: IPersonChip;
	rate: number;
	currency: string;
	periodHours: number;
	periodCost: number;
	totalCost: number;
}

interface ICostSummary {
	rows: ICostRow[];
	/** Totals per currency: members can bill in different ones. */
	totals: { currency: string; period: number; total: number }[];
	/** A cost budget in the project's currency, against what has been spent in it. */
	budget: { amount: number; currency: string; spent: number; percent: number; over: boolean } | null;
}

/** People shown on the heatmap, the busiest first. */
const HEATMAP_PEOPLE = 8;
/** Days the heatmap can show; a longer window shows its last days. */
const HEATMAP_DAYS = 31;

/**
 * The project page's Time tab, in the manner of Hubstaff: who worked on which day (a heatmap of the
 * busiest people's hours), the apps and websites used, the latest screenshots, and — for those who
 * may see bill rates — what the time cost, against a cost budget when there is one. Every figure is
 * everyone's time on the project in the period.
 */
@Component({
	selector: 'ga-project-time',
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe,
		ScreenshotsItemModule
	],
	templateUrl: './project-time.component.html',
	styleUrls: [
		'../../../../employees/view-employee/view-employee.component.scss',
		'../../project-quick-look/project-quick-look.component.scss',
		'./project-time.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class ProjectTimeComponent implements OnChanges {
	@Input() projectId: string;
	@Input() organizationId: string;
	@Input() tenantId: string;
	@Input() rangeStart: string;
	@Input() rangeEnd: string;

	public heatmap: Loadable<IHeatmap | null> = loading(null);
	public apps: Loadable<IAppRow[]> = loading([]);
	public screenshots: Loadable<ITimeSlot[]> = loading([]);
	public cost: Loadable<ICostSummary | null> = loading(null);
	/** Bill rates are shown only to those who may see them. */
	public canSeeRates = false;

	readonly formatDuration = formatDuration;
	readonly formatPercent = formatPercent;

	private readonly _store = inject(Store);
	private readonly _timeZoneService = inject(TimeZoneService);
	private readonly _statisticsService = inject(TimesheetStatisticsService);
	private readonly _timesheetService = inject(TimesheetService);
	private readonly _projectsService = inject(OrganizationProjectsService);
	private _project: IOrganizationProject | null = null;
	private _sequence = 0;

	ngOnChanges(changes: SimpleChanges): void {
		if (!this.projectId) return;
		if (changes['projectId'] || changes['organizationId']) this._project = null;
		if (changes['projectId'] || changes['organizationId'] || changes['rangeStart'] || changes['rangeEnd']) {
			void this.load();
		}
	}

	get rangeLabel(): string {
		return rangeLabelOf(this.rangeStart, this.rangeEnd);
	}

	get timeZone(): string {
		return this._timeZoneService.currentTimeZone;
	}

	get timeFormat(): TimeFormatEnum {
		return this._timeZoneService.currentTimeFormat;
	}

	/** Shade 0–4 of a heatmap cell, against the busiest cell. */
	level(hours: number, max: number): number {
		if (!hours || !max) return 0;
		return Math.min(4, Math.max(1, Math.ceil((hours / max) * 4)));
	}

	formatHours(hours: number): string {
		return formatDuration((Number(hours) || 0) * 3600);
	}

	formatMoney(amount: number, currency: string): string {
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
				amount
			);
		} catch {
			return `${Math.round(amount).toLocaleString()} ${currency || ''}`.trim();
		}
	}

	reloadScreenshots(): void {
		void this.loadScreenshots(this._sequence);
	}

	private async load(): Promise<void> {
		const sequence = ++this._sequence;
		this.canSeeRates = this._store.hasAnyPermission(
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_EMPLOYEES_EDIT
		);
		this.heatmap = loading(null);
		this.apps = loading([]);
		this.screenshots = loading([]);
		this.cost = loading(null);

		const request = this.request(moment(this.rangeStart), moment(this.rangeEnd));
		const members = this._statisticsService.getMembers(request);
		void this.loadApps(sequence);
		void this.loadScreenshots(sequence);
		void this.loadHeatmap(sequence, members);
		if (this.canSeeRates) void this.loadCost(sequence, members);
	}

	private request(start: moment.Moment, end: moment.Moment) {
		return statisticsRequest(
			{ organizationId: this.organizationId, tenantId: this.tenantId, projectId: this.projectId },
			{ start, end },
			this._timeZoneService.currentTimeZone
		);
	}

	/**
	 * The busiest people's hours per day: who they are from the period's member statistics, then
	 * each one's daily chart on the project — the same read as the Overview's daily activity.
	 */
	private async loadHeatmap(sequence: number, members: Promise<IMembersStatistics[]>): Promise<void> {
		try {
			const rows = (await members) || [];
			const top = rows
				.map((row) => ({ row, duration: Number(row.weekTime?.duration) || 0 }))
				.filter(({ duration }) => duration > 0)
				.sort((a, b) => b.duration - a.duration)
				.slice(0, HEATMAP_PEOPLE);
			const end = moment.min(moment(this.rangeEnd), moment().endOf('day'));
			const start = moment.max(
				moment(this.rangeStart),
				end
					.clone()
					.subtract(HEATMAP_DAYS - 1, 'days')
					.startOf('day')
			);
			const days: moment.Moment[] = [];
			for (const day = start.clone().startOf('day'); day.isSameOrBefore(end, 'day'); day.add(1, 'day')) {
				days.push(day.clone());
			}
			const charts = await Promise.all(
				top.map(({ row }) =>
					this._timesheetService
						.getDailyReportChart({ ...this.request(start, end), employeeIds: [row.id] })
						.catch((): any[] => [])
				)
			);
			if (sequence !== this._sequence) return;
			const keys = days.map((day) => day.format('YYYY-MM-DD'));
			const heatRows: IHeatmapRow[] = top.map(({ row }, index) => {
				const byDate = new Map<string, number>(
					(Array.isArray(charts[index]) ? charts[index] : []).map((day: any) => [
						moment(day.date).format('YYYY-MM-DD'),
						(Number(day.value?.[TimeLogType.TRACKED]) || 0) +
							(Number(day.value?.[TimeLogType.RESUMED]) || 0) +
							(Number(day.value?.[TimeLogType.MANUAL]) || 0)
					])
				);
				const hours = keys.map((key) => byDate.get(key) || 0);
				const name = row.user?.name || '';
				return {
					person: personOf({ id: row.id, fullName: name, imageUrl: row.user?.imageUrl }) || {
						id: row.id,
						name: '—',
						initials: '?'
					},
					hours,
					total: hours.reduce((sum, value) => sum + value, 0)
				};
			});
			const format = days.length <= 7 ? 'ddd' : 'D';
			this.heatmap = loaded({
				days: days.map((day) => ({
					label: day.format(format),
					long: day.format('dddd, ll'),
					weekend: day.isoWeekday() >= 6
				})),
				rows: heatRows,
				max: Math.max(0, ...heatRows.flatMap((row) => row.hours))
			});
		} catch {
			if (sequence === this._sequence) this.heatmap = failed(null);
		}
	}

	private async loadApps(sequence: number): Promise<void> {
		try {
			const rows: IActivitiesStatistics[] = await this._statisticsService.getActivities(
				this.request(moment(this.rangeStart), moment(this.rangeEnd))
			);
			if (sequence !== this._sequence) return;
			const items = (rows || [])
				.map((row) => ({ title: row.title, duration: Number(row.duration) || 0 }))
				.filter((row) => !!row.title && row.duration > 0)
				.sort((a, b) => b.duration - a.duration);
			const total = items.reduce((sum, row) => sum + row.duration, 0) || 1;
			const max = items[0]?.duration || 1;
			this.apps = loaded(
				items.slice(0, 8).map((row) => ({
					...row,
					share: (row.duration / total) * 100,
					width: Math.max(2, (row.duration / max) * 100)
				}))
			);
		} catch {
			if (sequence === this._sequence) this.apps = failed([]);
		}
	}

	/** The period's latest screenshots on the project, by anyone, newest first. */
	private async loadScreenshots(sequence: number): Promise<void> {
		try {
			const employees = await this._statisticsService.getTimeSlots(
				this.request(moment(this.rangeStart), moment(this.rangeEnd))
			);
			if (sequence !== this._sequence) return;
			const slots = (employees || [])
				.flatMap((employee) =>
					(employee.timeSlots || []).map((slot) => ({ ...slot, employeeId: slot.employeeId || employee.id }))
				)
				.filter((slot) => (slot.screenshots || []).length > 0)
				.sort((a, b) => moment(b.startedAt).valueOf() - moment(a.startedAt).valueOf())
				.slice(0, 8);
			this.screenshots = loaded(slots);
		} catch {
			if (sequence === this._sequence) this.screenshots = failed([]);
		}
	}

	/**
	 * Each member's bill rate times their hours: in the period (from the member statistics the
	 * heatmap reads) and since the project started. People without a rate are left out.
	 */
	private async loadCost(sequence: number, members: Promise<IMembersStatistics[]>): Promise<void> {
		try {
			if (!this._project) {
				this._project = await firstValueFrom(
					this._projectsService.getById(this.projectId, [
						'members',
						'members.employee',
						'members.employee.user'
					])
				);
			}
			const project = this._project;
			const lifetimeStart = moment(project?.startDate || project?.createdAt || this.rangeStart).startOf('day');
			const [period, lifetime] = await Promise.all([
				members,
				this._statisticsService.getMembers(this.request(lifetimeStart, moment().endOf('day')))
			]);
			if (sequence !== this._sequence) return;
			const periodTime = new Map((period || []).map((row) => [row.id, Number(row.weekTime?.duration) || 0]));
			const lifetimeTime = new Map((lifetime || []).map((row) => [row.id, Number(row.weekTime?.duration) || 0]));

			const rows: ICostRow[] = (project?.members || [])
				.map((member) => member.employee as IEmployee)
				.filter((employee) => !!employee && Number(employee.billRateValue) > 0)
				.map((employee) => {
					const rate = Number(employee.billRateValue);
					const periodHours = (periodTime.get(employee.id) || 0) / 3600;
					return {
						person: personOf(employee),
						rate,
						currency: employee.billRateCurrency || project.currency || '',
						periodHours,
						periodCost: periodHours * rate,
						totalCost: ((lifetimeTime.get(employee.id) || 0) / 3600) * rate
					};
				})
				.filter((row) => !!row.person)
				.sort((a, b) => b.periodCost - a.periodCost || b.totalCost - a.totalCost);

			const totals = new Map<string, { currency: string; period: number; total: number }>();
			for (const row of rows) {
				const entry = totals.get(row.currency) || { currency: row.currency, period: 0, total: 0 };
				entry.period += row.periodCost;
				entry.total += row.totalCost;
				totals.set(row.currency, entry);
			}

			let budget: ICostSummary['budget'] = null;
			const amount = Number(project?.budget) || 0;
			if (project?.budgetType === OrganizationProjectBudgetTypeEnum.COST && amount > 0) {
				const currency = project.currency || rows[0]?.currency || '';
				const spent = totals.get(currency)?.total || 0;
				const used = (spent / amount) * 100;
				budget = { amount, currency, spent, percent: Math.min(100, used), over: used > 100 };
			}
			this.cost = loaded({ rows, totals: [...totals.values()], budget });
		} catch {
			if (sequence === this._sequence) this.cost = failed(null);
		}
	}
}
