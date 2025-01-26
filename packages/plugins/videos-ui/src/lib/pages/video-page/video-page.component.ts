import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IGetTimeSlotInput, ITimeLogFilters } from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store, TimesheetFilterService } from '@gauzy/ui-core/core';
import { BaseSelectorFilterComponent, GauzyFiltersComponent, TimeZoneService } from '@gauzy/ui-core/shared';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, map, Observable, of, switchMap, tap, withLatestFrom } from 'rxjs';
import { pick } from 'underscore';
import { VideoActions } from '../../+state/video.action';
import { VideoQuery } from '../../+state/video.query';
import { VideoStore } from '../../+state/video.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-video-page',
	templateUrl: './video-page.component.html',
	styleUrl: './video-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPageComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	private skip = 0;
	private hasNext = false;
	private readonly take = 10;
	filters: ITimeLogFilters = this.request;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly actions: Actions,
		private readonly videoQuery: VideoQuery,
		private readonly videoStore: VideoStore,
		public readonly translateService: TranslateService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService,
		private readonly timesheetFilterService: TimesheetFilterService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				map(() => this.prepareRequest()),
				withLatestFrom(this.videoQuery.count$.pipe(map((count) => count > this.skip * this.take))),
				distinctUntilChange(),
				switchMap(([request, hasNext]) => {
					return of(request).pipe(
						filter(Boolean),
						distinctUntilChange(),
						tap(() => {
							this.skip = 1;
							this.fetchVideos();
							this.hasNext = hasNext;
						})
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public filtersChange(filters: ITimeLogFilters): void {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = { ...filters };
		this.subject$.next(true);
	}

	public prepareRequest(): IGetTimeSlotInput {
		if (isEmpty(this.request) || isEmpty(this.filters) || !this.organization) {
			return;
		}
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');
		return {
			...appliedFilter,
			...this.getFilterRequest(this.request)
		};
	}

	public fetchVideos(): void {
		const request = this.prepareRequest();
		if (!request) {
			return;
		}
		this.actions.dispatch(
			VideoActions.fetchVideos({
				...request,
				skip: this.skip,
				take: this.take,
				relations: ['uploadedBy', 'uploadedBy.user'],
				order: { recordedAt: 'DESC' }
			})
		);
	}

	public fetchMoreVideos(): void {
		if (this.hasNext) {
			this.skip++;
			this.fetchVideos();
		}
	}

	public reset(): void {
		this.skip = 0;
		this.hasNext = false;
		this.videoStore.update({ videos: [] });
	}

	public get count$(): Observable<number> {
		return this.videoQuery.count$;
	}

	public get isLoading$(): Observable<boolean> {
		return this.videoQuery.isLoading$;
	}

	ngOnDestroy() {
		this.reset();
	}
}
