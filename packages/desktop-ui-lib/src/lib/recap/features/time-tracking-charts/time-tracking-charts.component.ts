import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ITimeSlot } from '@gauzy/contracts';
import { progressStatus } from '@gauzy/ui-core/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, concatMap, from, map } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { AutoRefreshService } from '../../+state/auto-refresh/auto-refresh.service';
import { RecapQuery } from '../../+state/recap.query';
import { RecapService } from '../../+state/recap.service';
import { RequestQuery } from '../../+state/request/request.query';
import { IChartData } from '../../shared/utils/adapters/chart.adapter';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-time-tracking-charts',
	templateUrl: './time-tracking-charts.component.html',
	styleUrls: ['./time-tracking-charts.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeTrackingChartsComponent implements OnInit {
	private readonly _chartData$: BehaviorSubject<IChartData[]> = new BehaviorSubject([]);

	constructor(
		private readonly recapQuery: RecapQuery,
		private readonly requestQuery: RequestQuery,
		private readonly service: RecapService,
		private readonly autoRefreshService: AutoRefreshService
	) {}

	// options
	animations = true;
	showXAxis = true;
	showYAxis = false;
	gradient = true;
	showLegend = false;
	showXAxisLabel = true;
	xAxisLabel = '';
	showYAxisLabel = true;
	yAxisLabel = '';
	maxXAxisTickLength = 8;
	barPadding = 0;
	rotateXAxisTicks = true;
	wrapTicks = true;
	roundEdges = false;
	colorScheme = {
		domain: ['#6e49e8']
	};

	ngOnInit(): void {
		combineLatest([this.recapQuery.range$, this.requestQuery.request$, this.autoRefreshService.refresh$])
			.pipe(
				concatMap(() => this.load()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public load(): Observable<void> {
		return from(Promise.allSettled([this.service.getTimeSlots(), this.service.getCounts()])).pipe(
			map(() => this._chartData$.next(this.trim(this.groupAndSumTimeslotsByHour(this.timeSlots))))
		);
	}

	private get timeSlots() {
		return this.recapQuery.timeSlots;
	}

	public get dailyDuration$(): Observable<number> {
		return this.recapQuery.state$.pipe(map((state) => state.count.weekDuration));
	}

	public get dailyActivities$(): Observable<number> {
		return this.recapQuery.state$.pipe(map((state) => state.count.weekActivities / 100));
	}

	public get chartData$(): Observable<IChartData[]> {
		return this._chartData$.asObservable();
	}

	private groupAndSumTimeslotsByHour(timeslots: ITimeSlot[]): IChartData[] {
		const hourlySum: number[] = Array(24).fill(0);

		for (const timeslot of timeslots) {
			if (timeslot.stoppedAt && timeslot.overall !== undefined) {
				const hour = new Date(timeslot.stoppedAt).getHours();
				hourlySum[hour] += timeslot.overall;
			}
		}

		return hourlySum.map((value, index) => ({
			name: `${index}h`,
			value
		}));
	}

	private trim(chartData: IChartData[]): IChartData[] {
		let firstNonZeroIndex = -1;
		let lastNonZeroIndex = -1;

		// Find the first and last non-zero value indices
		for (let i = 0; i < chartData.length; i++) {
			if (chartData[i].value && chartData[i].value !== 0) {
				if (firstNonZeroIndex === -1) {
					firstNonZeroIndex = i;
				}
				lastNonZeroIndex = i;
			}
		}

		// If there are no non-zero  values, return an empty array
		if (firstNonZeroIndex === -1) {
			return [];
		}

		// Trim the timeslots array
		return chartData.slice(firstNonZeroIndex, lastNonZeroIndex + 1);
	}

	public getStatus(value: number) {
		return progressStatus(value / 36);
	}
}
