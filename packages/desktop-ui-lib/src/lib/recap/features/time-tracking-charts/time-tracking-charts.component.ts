import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ITimeSlot } from '@gauzy/contracts';
import { distinctUntilChange, progressStatus } from '@gauzy/ui-core/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, concatMap, map, tap } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
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
	private readonly recapQuery = inject(RecapQuery);
	private readonly requestQuery = inject(RequestQuery);
	private readonly service = inject(RecapService);
	private readonly _chartData$: BehaviorSubject<IChartData[]> = new BehaviorSubject([]);

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
	colorScheme = {
		domain: ['#6e49e8']
	};

	ngOnInit(): void {
		combineLatest([this.recapQuery.range$, this.requestQuery.request$])
			.pipe(
				distinctUntilChange(),
				concatMap(() => Promise.allSettled([this.service.getTimeSlots(), this.service.getCounts()])),
				tap(() => this._chartData$.next(this.trim(this.groupAndSumTimeslotsByHour(this.timeSlots)))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private get timeSlots() {
		return this.recapQuery.timeSlots;
	}

	public get dailyDuration$(): Observable<number> {
		return this.recapQuery.state$.pipe(map((state) => state.count.weekDuration));
	}

	public get dailyActivities$(): Observable<string> {
		return this.recapQuery.state$.pipe(map((state) => state.count.weekActivities.toFixed(2)));
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
