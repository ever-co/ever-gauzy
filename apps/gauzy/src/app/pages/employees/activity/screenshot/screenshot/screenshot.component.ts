import {
	Component,
	OnInit,
	OnDestroy,
	ViewChild,
	inject
} from '@angular/core';
import { BehaviorSubject, EMPTY, from, Observable, Subject } from 'rxjs';
import { catchError, debounceTime, filter, finalize, switchMap, tap } from 'rxjs/operators';
import { chain, indexBy, pick, sortBy } from 'underscore';
import * as moment from 'moment-timezone';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	ITimeLogFilters,
	ITimeSlot,
	IGetTimeSlotInput,
	IScreenshotMap,
	IScreenshot,
	PermissionsEnum,
	ID
} from '@gauzy/contracts';
import { isEmpty, distinctUntilChange, toTimezone } from '@gauzy/ui-core/common';
import {
	DateRangePickerBuilderService,
	Store,
	TimesheetFilterService,
	TimesheetService,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	BaseSelectorFilterComponent,
	DeleteConfirmationComponent,
	GalleryItem,
	GalleryService,
	GauzyFiltersComponent,
	TimeZoneService
} from '@gauzy/ui-core/shared';

export interface IScreenshotUrls {
	thumbUrl: string;
	fullUrl: string;
}

/**
 * One cell of an hour row: a time slot's card, or a run of 10-minute positions
 * without tracked time merged into a single block (`span` columns wide).
 */
export interface IHourSegment {
	key: string;
	slot?: ITimeSlot;
	startTime?: string;
	endTime?: string;
	minutes?: number;
	span?: number;
}

export interface IHourSlotGroup extends IScreenshotMap {
	/** The hour's cards and gaps, in time order. */
	segments: IHourSegment[];
	/** Whether each of the six 10-minute positions has tracked time. */
	filled: boolean[];
	/** Minutes of tracked time in the hour. */
	trackedMinutes: number;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-screenshots',
	templateUrl: './screenshot.component.html',
	styleUrls: ['./screenshot.component.scss'],
	standalone: false,
	// As the dashboard's Recent Activities widget does: a screenshot store of this
	// page's own, and the dialog service that hands it to the gallery (and View
	// Info) dialogs. With the root dialog service they resolve the root store.
	providers: [GalleryService, NbDialogService]
})
export class ScreenshotComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	private readonly _timesheetService = inject(TimesheetService);
	private readonly _timesheetFilterService = inject(TimesheetFilterService);
	private readonly _nbDialogService = inject(NbDialogService);
	private readonly _galleryService = inject(GalleryService);
	private readonly _toastrService = inject(ToastrService);


	private _slotIdsMap: Map<string, ID[]> = new Map();
	/** Ids of the screenshots the last load fetched, so the next reload can drop them. */
	private _galleryItemIds: Set<ID> = new Set();
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);
	screenshots$: Subject<boolean> = new Subject();
	filters: ITimeLogFilters = this.request;
	timeSlots: IHourSlotGroup[] = [];
	originalTimeSlots: ITimeSlot[] = [];
	screenshotsUrls: IScreenshotUrls[] = [];
	selectedIdsCount: number = 0;
	loading: boolean = false;
	allSelected: boolean = false;
	selectedIds: Record<ID, boolean> = {};

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		protected readonly translateService: TranslateService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit(): void {
		// Filter changes → prepare request → fetch screenshots (single reactive chain)
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				debounceTime(100),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();

		// When payloads change, fetch new screenshots
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				switchMap(() => this.fetchTimeSlotsScreenshots()),
				untilDestroyed(this)
			)
			.subscribe();

		// Re-fetch screenshots on single slot deletion
		this.screenshots$
			.pipe(
				filter(() => !!this.organization && !isEmpty(this.request)),
				switchMap(() => this.fetchTimeSlotsScreenshots()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles changes in time log filters.
	 * If the saveFilters flag is enabled, saves the filters using the timesheetFilterService.
	 * Updates the component's filters and notifies subscribers about the filter change.
	 *
	 * @param filters The new set of filters for time logs.
	 */
	filtersChange(filters: ITimeLogFilters): void {
		// Check if the saveFilters flag is enabled
		if (this.gauzyFiltersComponent.saveFilters) {
			// Save filters using the timesheetFilterService if saveFilters is enabled
			this._timesheetFilterService.filter = filters;
		}

		// Update the component's filters by creating a shallow copy of the filters object
		this.filters = { ...filters };

		// Notify subscribers about the filter change
		this.subject$.next(true);
	}

	/**
	 * Prepare Unique Request Always
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// Extract specific properties from filters
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');

		// Construct request object
		const request: IGetTimeSlotInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			relations: [
				// Include additional relations based on permissions
				...(this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) ? ['employee.user'] : []),
				'screenshots',
				'timeLogs'
			]
		};
		this.payloads$.next(request);
	}

	/**
	 * Fetches time slot screenshots as an Observable.
	 * Designed for use with switchMap to cancel in-flight requests on new emissions.
	 */
	private fetchTimeSlotsScreenshots(): Observable<ITimeSlot[]> {
		this.loading = true;

		this.screenshotsUrls = [];
		this.timeSlots = [];
		this.originalTimeSlots = [];

		const payloads = this.payloads$.getValue();

		return from(this._timesheetService.getTimeSlots(payloads)).pipe(
			tap((timeSlots: ITimeSlot[]) => {
				this.originalTimeSlots = timeSlots;
				this._syncGallery(timeSlots);
				this.timeSlots = this.groupTimeSlots(timeSlots);
			}),
			catchError((error) => {
				console.error('Error while retrieving screenshots for employee', error);
				this._toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED', 'TOASTR.TITLE.ERROR');
				return EMPTY;
			}),
			finalize(() => {
				this.loading = false;
			})
		);
	}

	/**
	 * Toggles the selection state of a time slot identified by its ID.
	 * If a slotId is provided, toggles the selection state of the corresponding slot.
	 * Otherwise, updates all selections based on the current state of selectedIds.
	 *
	 * @param slotId The ID of the time slot to toggle selection for.
	 */
	toggleSelect(slotId?: ID): void {
		if (slotId) {
			// Toggle the selection state of the time slot identified by slotId
			this.selectedIds[slotId] = !this.selectedIds[slotId];
		}

		// Update selections based on the current state of selectedIds
		this.updateSelections();
	}

	/**
	 * Toggles the selection state of all time slots.
	 * Iterates through each time slot in selectedIds and toggles its selection state.
	 * After toggling all selections, updates the selections.
	 */
	toggleAllSelect(): void {
		for (const key in this.selectedIds) {
			if (this.selectedIds.hasOwnProperty(key)) {
				// Toggle the selection state of each time slot
				this.selectedIds[key] = !this.allSelected;
			}
		}

		// Update selections after toggling all time slots
		this.updateSelections();
	}

	/**
	 * Updates the selection state of time slots based on the selectedIds object.
	 * Counts the number of selected time slots and updates the allSelected flag accordingly.
	 */
	updateSelections(): void {
		// Count the number of selected time slots
		this.selectedIdsCount = Object.values(this.selectedIds).filter((val) => val === true).length;

		// Update the allSelected flag based on the number of selected time slots
		this.allSelected = this.selectedIdsCount === Object.values(this.selectedIds).length;
	}

	/**
	 * Returns all slot IDs grouped under the given primary slot ID.
	 */
	getSlotIds(primaryId: ID): ID[] {
		return this._slotIdsMap.get(primaryId as string) || [primaryId];
	}

	/**
	 * Handles a single-slot deletion event from the screenshots-item child.
	 * Cleans up the gallery for the deleted slot IDs, then triggers a refetch.
	 *
	 * @param deletedIds The IDs of the time slots that were deleted.
	 */
	deleteSlot(deletedIds: ID[]): void {
		if (deletedIds?.length) {
			this._deleteScreenshotGallery(deletedIds);
		}
		this.screenshots$.next(true);
	}

	/**
	 * Initiates the deletion of multiple time slots.
	 * Opens a dialog for confirmation, then proceeds with the deletion if confirmed.
	 * After deletion, updates the screenshot gallery and notifies subscribers about the deletion.
	 */
	deleteSlots(): void {
		// Expand selected primary IDs to include all grouped slot IDs
		const allIds = Object.entries(this.selectedIds)
			.filter(([, selected]) => selected)
			.flatMap(([id]) => this._slotIdsMap.get(id as string) || [id]);

		if (!allIds.length) return;

		const { id: organizationId, tenantId } = this.organization;

		this._nbDialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(
				filter((result) => result === 'ok'),
				switchMap(() =>
					from(
						this._timesheetService.deleteTimeSlots({
							ids: allIds,
							organizationId,
							tenantId
						})
					)
				),
				tap(() => this._handleDeletedSlots(allIds)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles UI updates after slots are deleted.
	 */
	private _handleDeletedSlots(ids: ID[]): void {
		this._deleteScreenshotGallery(ids);
		this.selectedIds = {};
		this.selectedIdsCount = 0;
		this.screenshots$.next(true);
	}

	/**
	 * Groups time slots by hour and prepares data for display.
	 * Also generates screenshot URLs and calculates employee work on the same time slots.
	 *
	 * @param slots An array of time slots to be grouped.
	 * @returns An array of grouped time slots for display.
	 */
	private groupTimeSlots(slots: ITimeSlot[]): IHourSlotGroup[] {
		this.selectedIds = {};
		this._slotIdsMap = new Map();
		const timezone = this.filters?.timeZone;
		const screenshotUrls: { thumbUrl: string; fullUrl: string }[] = [];

		for (const slot of slots) {
			if (slot.screenshots?.length) {
				for (const screenshot of slot.screenshots) {
					screenshotUrls.push({ thumbUrl: screenshot.thumbUrl, fullUrl: screenshot.fullUrl });
				}
			}
		}
		this.screenshotsUrls = screenshotUrls;

		const convertTime = (slot: ITimeSlot) =>
			timezone ? toTimezone(slot.startedAt, timezone) : moment.utc(slot.startedAt).local();
		const getHour = (slot: ITimeSlot) => convertTime(slot).format('HH');
		const getMinute = (slot: ITimeSlot) => convertTime(slot).format('mm');

		const result = chain(slots)
			.groupBy(getHour)
			.mapObject((hourSlots: ITimeSlot[], hour): IHourSlotGroup => {
				const groupByMinutes = chain(hourSlots).groupBy(getMinute).value();
				const byMinutes = indexBy(sortBy(hourSlots, 'screenshots'), getMinute);

				const positions = ['00', '10', '20', '30', '40', '50'];
				const slotsByMinute = positions.map((key) => {
					if (!(key in byMinutes)) {
						return null;
					}

					// Collect all slot IDs for this minute bucket
					const slotIds = (groupByMinutes[key] || []).map((slot: ITimeSlot) => slot.id);

					// Register only the primary slot ID in selectedIds, map it to all grouped IDs
					const primaryId = byMinutes[key].id;
					this.selectedIds[primaryId] = false;
					this._slotIdsMap.set(primaryId as string, slotIds);

					byMinutes[key]['employees'] = chain(groupByMinutes[key])
						.groupBy((slot: ITimeSlot) => slot.employeeId)
						.values()
						.flatten()
						.map((slot: ITimeSlot) => slot.employee)
						.value();

					return byMinutes[key];
				});

				const time = moment().set('hour', Number.parseInt(hour, 10)).set('minute', 0);
				const startTime = time.format('HH:mm');
				const endTime = time.add(1, 'hour').format('HH:mm');

				// Tracked minutes: the longest slot of each position, so two people
				// working the same 10 minutes do not count it twice. Only the six
				// positions on screen count, so the total matches the strip and cards.
				const trackedSeconds = positions.reduce(
					(total: number, key: string) =>
						total + Math.max(0, ...(groupByMinutes[key] ?? []).map((slot: ITimeSlot) => slot.duration || 0)),
					0
				);

				return {
					startTime,
					endTime,
					timeSlots: slotsByMinute,
					segments: this.toHourSegments(startTime, slotsByMinute),
					filled: slotsByMinute.map((slot: ITimeSlot) => !!slot),
					trackedMinutes: Math.round(trackedSeconds / 60)
				};
			})
			.values()
			.sortBy(({ startTime }) => moment(startTime, 'HH:mm').toDate().getTime())
			.value();

		this.updateSelections();
		return result;
	}

	/**
	 * Turns an hour's six 10-minute positions into cards and gaps, merging each run
	 * of empty positions into one gap that says how long nothing was tracked.
	 *
	 * @param hourStart The hour's start, as `HH:mm`.
	 * @param slotsByMinute The slot at each position, or `null` where there is none.
	 * @returns The hour's segments, in time order.
	 */
	private toHourSegments(hourStart: string, slotsByMinute: ITimeSlot[]): IHourSegment[] {
		const at = (position: number) =>
			moment(hourStart, 'HH:mm')
				.add(position * 10, 'minutes')
				.format('HH:mm');

		const segments: IHourSegment[] = [];
		slotsByMinute.forEach((slot: ITimeSlot, position: number) => {
			if (slot) {
				segments.push({ key: slot.id as string, slot });
				return;
			}

			const previous = segments[segments.length - 1];
			if (previous && !previous.slot) {
				previous.span += 1;
				previous.minutes += 10;
				previous.endTime = at(position + 1);
			} else {
				segments.push({
					key: `gap-${hourStart}-${position}`,
					startTime: at(position),
					endTime: at(position + 1),
					minutes: 10,
					span: 1
				});
			}
		});
		return segments;
	}

	/**
	 * Deletes screenshots associated with the specified time slots from the gallery.
	 *
	 * @param slotIds An array of time slot IDs whose screenshots should be removed from the gallery.
	 */
	private _deleteScreenshotGallery(slotIds: ID[]): void {
		if (isEmpty(slotIds) || isEmpty(this.originalTimeSlots)) {
			return;
		}

		const idsToRemove = new Set(slotIds);
		const screenshotsToRemove = this.originalTimeSlots
			.filter((slot: ITimeSlot) => idsToRemove.has(slot.id))
			.flatMap((slot: ITimeSlot) =>
				(slot.screenshots ?? []).map((screenshot: IScreenshot) => ({
					thumbUrl: screenshot.thumbUrl,
					fullUrl: screenshot.fullUrl,
					...screenshot
				}))
			);

		if (screenshotsToRemove.length) {
			this._galleryService.removeGalleryItems(screenshotsToRemove);
		}
	}

	/**
	 * Drops every screenshot the previous load put in the gallery store, then
	 * tracks the ones just fetched for the next reload.
	 *
	 * Nothing from the previous load is kept. `fetchTimeSlotsScreenshots` empties
	 * `timeSlots` before the request, so every card is rebuilt and its `ngxGallery`
	 * directive appends its screenshots afresh. Keeping an item left behind the
	 * screenshot of a slot that is no longer its minute's primary card, and because
	 * the store keeps the first item per id, it also kept the old copy over the new.
	 *
	 * @param slots The time slots that were just fetched.
	 */
	private _syncGallery(slots: ITimeSlot[]): void {
		if (this._galleryItemIds.size) {
			this._galleryService.removeGalleryItems(
				[...this._galleryItemIds].map((id: ID) => ({ id } as GalleryItem))
			);
		}

		this._galleryItemIds = new Set<ID>(
			slots.flatMap((slot: ITimeSlot) => (slot.screenshots ?? []).map((screenshot: IScreenshot) => screenshot.id))
		);
	}

	ngOnDestroy(): void {
		this._galleryService.clearGallery();
	}
}
