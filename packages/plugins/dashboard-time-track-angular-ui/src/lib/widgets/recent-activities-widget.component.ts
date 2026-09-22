import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	effect,
	inject,
	signal
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbButtonModule, NbDialogService } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom, Observable } from 'rxjs';
// Registers the `<swiper-container>` / `<swiper-slide>` custom elements. Kept as
// a module-level side effect (like the legacy dashboard component) because the
// elements have to exist before the template that uses them is first rendered;
// `register()` is idempotent and a no-op outside a browser.
import { register } from 'swiper/element/bundle';
import {
	ID,
	IEmployee,
	IScreenshot,
	ISelectedEmployee,
	ITimeSlot,
	ITimeSlotStatistics,
	PermissionsEnum,
	TimeFormatEnum
} from '@gauzy/contracts';
import { EmployeesService, IDashboardWidgetContext, Store } from '@gauzy/ui-core/core';
import {
	ALL_EMPLOYEES_SELECTED,
	ComponentsModule,
	DateFormatPipe,
	GalleryItem,
	GalleryService,
	ScreenshotsItemModule,
	TimeZoneService,
	UtcToLocalPipe
} from '@gauzy/ui-core/shared';
import { BaseTimeTrackListWidgetComponent } from './base-time-track-list-widget.component';
import { TimeTrackWidgetStateComponent } from './time-track-widget-state.component';

register();

/**
 * List widget: the screenshot carousel of the legacy dashboard's "Recent
 * Activities" window.
 *
 * One row per member that recorded time slots in the selected range, each row a
 * Swiper carousel of `ngx-screenshots-item` cards — the very component the
 * Screenshots page and the legacy dashboard render, reused as-is so the hover
 * actions (view screen, view info, delete) behave identically.
 *
 * ## Why this widget provides `GalleryService` AND `NbDialogService`
 *
 * `GalleryService` is `providedIn: 'root'`, i.e. ONE screenshot store for the
 * whole application: every `ngxGallery` directive appends its images to it, and
 * the legacy page empties it wholesale (`clearGallery()`) on each reload and on
 * destroy. That is fine for a page — there is only ever one — but on a canvas the
 * same widget can be dropped several times, each pinned to a different range or
 * employee. Sharing one store would mean widget A's reload wipes widget B's
 * images, and B's gallery dialog would page through A's screenshots.
 *
 * Providing `GalleryService` here puts one store on each widget INSTANCE'S node
 * injector, which both `ScreenshotsItemComponent` and the `ngxGallery` directive
 * inside it resolve through. `NbDialogService` has to be provided alongside it:
 * `GalleryComponent` (the full-screen gallery dialog) is created by
 * `NbDialogService`, which parents it on
 * `config.viewContainerRef?.injector || <the injector the service itself lives
 * in>` — and `GalleryDirective` passes no `viewContainerRef`. With the ROOT
 * dialog service the gallery would therefore resolve the ROOT store and open
 * empty; instantiated from this component's node injector it resolves ours.
 *
 * The item bookkeeping in {@link syncGallery} is deliberately written so it stays
 * correct even if that injector plumbing ever regressed to the root store: it
 * only ever removes the images THIS widget contributed, and never calls
 * `clearGallery()`.
 */
@Component({
	selector: 'gz-recent-activities-widget',
	templateUrl: './recent-activities-widget.component.html',
	styleUrls: ['./time-track-list-widget.scss', './recent-activities-widget.component.scss'],
	standalone: true,
	imports: [
		NbButtonModule,
		TranslateModule,
		ComponentsModule,
		DateFormatPipe,
		UtcToLocalPipe,
		ScreenshotsItemModule,
		TimeTrackWidgetStateComponent
	],
	providers: [
		// Per-instance screenshot store + the dialog service that hands it to the
		// gallery dialog. See the class doc for why both are needed together.
		GalleryService,
		NbDialogService,
		// `EmployeesService` is a plain `@Injectable()` (NOT `providedIn: 'root'`)
		// provided today by a handful of feature modules only. A canvas widget is
		// created through the host's own injector and may sit on any page, so it
		// provides the service itself rather than gambling on a NullInjectorError.
		EmployeesService
	],
	// `<swiper-container>` / `<swiper-slide>` are custom elements, not Angular components.
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecentActivitiesWidgetComponent extends BaseTimeTrackListWidgetComponent<ITimeSlotStatistics> {
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);
	private readonly _employeesService = inject(EmployeesService);
	private readonly _galleryService = inject(GalleryService);
	private readonly _timeZoneService = inject(TimeZoneService);

	/** @inheritdoc */
	protected readonly emptyMessageBaseKey = 'TIMESHEET.NO_SCREENSHOT';

	/**
	 * Images this widget contributed to the gallery store, keyed by screenshot id.
	 *
	 * Tracked so a reload can drop exactly the ones that fell out of the range —
	 * never the whole store, which is what would make two widgets fight over it.
	 */
	private _ownedItems = new Map<ID, GalleryItem>();

	/** Members that actually recorded something; a member without slots renders no row. */
	protected readonly employees = computed<ITimeSlotStatistics[]>(() =>
		this.rows().filter((employee: ITimeSlotStatistics) => (employee?.timeSlots?.length ?? 0) > 0)
	);

	/** True when a successful load produced no carousel to show. */
	protected readonly hasNoActivities = computed<boolean>(() => this.employees().length === 0);

	/** Time format the screenshot cards label their slots with. */
	protected readonly timeFormat = computed<TimeFormatEnum>(
		() => this.widgetContext()?.timeFormat ?? TimeFormatEnum.FORMAT_12_HOURS
	);

	/**
	 * Time zone the screenshot cards render their slot times in.
	 *
	 * Falls back to the app's current zone rather than emitting `undefined`: the
	 * card's `utcToTimezone` pipe would otherwise render every slot in UTC before
	 * the canvas has resolved its context.
	 */
	protected readonly timeZone = computed<string>(
		() => this.widgetContext()?.timeZone || this._timeZoneService.currentTimeZone
	);

	/** Bumped whenever role permissions change (sign-in, tenant switch, role edit). */
	private readonly _permissionsVersion = signal<number>(0);

	/**
	 * Whether the current user may look at other people's activity.
	 *
	 * Gates the member avatar and the "View all" jump exactly like the legacy
	 * window did: a user who cannot switch employees only ever sees their own
	 * screenshots, so naming the person and offering a per-person report is noise.
	 */
	protected readonly canChangeSelectedEmployee = computed<boolean>(() => {
		// Read the version so the flag is re-evaluated once permissions arrive.
		this._permissionsVersion();
		return this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
	});

	constructor() {
		super();

		// Permissions arrive asynchronously after sign-in and change on a tenant
		// switch; without this the widget would keep the very first evaluation.
		this._store.userRolePermissions$
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this._permissionsVersion.update((version: number) => version + 1));

		// Reconcile the gallery store whenever the fetched slots change. An effect
		// rather than a `tap` in the base pipeline: the base class owns that
		// pipeline, and the reconciliation is a projection of `rows()` either way.
		effect(() => this.syncGallery(this.rows()));

		// `DestroyRef.onDestroy` rather than an `ngOnDestroy` override: declaring
		// one on a subclass of `BaseDashboardWidgetComponent` shadows the method
		// `@UntilDestroy()` patched onto the base class.
		this.destroyRef.onDestroy(() => this.releaseGallery());
	}

	/**
	 * Reads the time slots (with their screenshots) for the current scope.
	 *
	 * @param context - The dashboard context to query for.
	 * @returns One entry per member that recorded time in the range.
	 */
	protected override fetch(context: IDashboardWidgetContext): Observable<ITimeSlotStatistics[]> {
		return this.statisticsCache.getTimeSlots(context);
	}

	/**
	 * Re-fetches after a screenshot (time slot) was deleted from this widget.
	 *
	 * `ScreenshotsItemComponent` has already removed the images from OUR gallery
	 * store and deleted the slot server side; this only refreshes the carousel so
	 * the emptied slot disappears.
	 */
	protected onDelete(): void {
		this.refresh();
	}

	/**
	 * Advances the carousel of one member's row.
	 *
	 * @param swiper - The `<swiper-container>` element of that row.
	 */
	protected slideNext(swiper: HTMLElement): void {
		(swiper as unknown as { swiper?: { slideNext: (speed: number) => void } }).swiper?.slideNext(100);
	}

	/**
	 * Rewinds the carousel of one member's row.
	 *
	 * @param swiper - The `<swiper-container>` element of that row.
	 */
	protected slidePrev(swiper: HTMLElement): void {
		(swiper as unknown as { swiper?: { slidePrev: (speed: number) => void } }).swiper?.slidePrev(100);
	}

	/**
	 * Timestamp shown next to a member's avatar ("last worked").
	 *
	 * Read through a method so the template does not index into a possibly empty
	 * array, which is what made the legacy markup throw on a member whose slots
	 * were filtered out between two change-detection passes.
	 *
	 * @param employee - The member row being rendered.
	 * @returns The start of their most recent slot, or `undefined`.
	 */
	protected lastWorkedAt(employee: ITimeSlotStatistics): Date | undefined {
		return employee?.timeSlots?.[0]?.startedAt;
	}

	/**
	 * Opens the full Screenshots report for one member.
	 *
	 * Mirrors the legacy "View all" button, including its side effect: the app's
	 * selected employee is switched, because the Screenshots page reads its
	 * subject from the global selection rather than from a route parameter.
	 *
	 * @param employee - The member whose screenshots to open.
	 */
	protected async openScreenshots(employee: IEmployee): Promise<void> {
		if (!employee?.id) {
			return;
		}

		try {
			const person: IEmployee = await firstValueFrom(
				this._employeesService.getEmployeeById(employee.id, ['user'])
			);

			this._store.selectedEmployee = person
				? ({
						id: person.id,
						firstName: person.user?.firstName,
						lastName: person.user?.lastName,
						imageUrl: person.user?.imageUrl,
						employeeLevel: person.employeeLevel,
						fullName: person.user?.name,
						shortDescription: person.short_description
					} as ISelectedEmployee)
				: ALL_EMPLOYEES_SELECTED;

			await this._router.navigate(['/pages/employees/activity/screenshots']);
		} catch {
			// A failed lookup or a guard-rejected navigation is not a data error:
			// turning it into the widget's error state would hide a perfectly good
			// carousel behind a retry button.
		}
	}

	/**
	 * Brings the gallery store in line with the slots currently on screen.
	 *
	 * Only the DIFFERENCE is removed. The `ngxGallery` directives append their own
	 * images when their card is created, so re-adding here would double up, and
	 * removing everything would strip the images of the cards that survived the
	 * reload (they are only appended once, in the directive's `ngOnInit`).
	 *
	 * @param rows - The members (with their slots) that were just fetched.
	 */
	private syncGallery(rows: ITimeSlotStatistics[]): void {
		const next = new Map<ID, GalleryItem>();

		for (const employee of rows ?? []) {
			for (const slot of employee?.timeSlots ?? []) {
				for (const screenshot of slot?.screenshots ?? []) {
					if (!screenshot?.id) {
						continue;
					}
					next.set(screenshot.id, this.toGalleryItem(screenshot, slot));
				}
			}
		}

		const stale: GalleryItem[] = [];
		for (const [id, item] of this._ownedItems) {
			if (!next.has(id)) {
				stale.push(item);
			}
		}
		if (stale.length) {
			this._galleryService.removeGalleryItems(stale);
		}

		this._ownedItems = next;
	}

	/** Drops every image this widget contributed, leaving any other widget's alone. */
	private releaseGallery(): void {
		if (this._ownedItems.size) {
			this._galleryService.removeGalleryItems(Array.from(this._ownedItems.values()));
			this._ownedItems = new Map<ID, GalleryItem>();
		}
	}

	/**
	 * Projects a screenshot into the shape the gallery store keys its items by.
	 *
	 * Mirrors what `ScreenshotsItemComponent` hands to `ngxGallery`, `employeeId`
	 * included — the gallery dialog filters on it to show one person's strip.
	 *
	 * @param screenshot - The screenshot to project.
	 * @param slot - The slot it belongs to, which carries the employee.
	 */
	private toGalleryItem(screenshot: IScreenshot, slot: ITimeSlot): GalleryItem {
		return {
			id: screenshot.id,
			thumbUrl: screenshot.thumbUrl,
			fullUrl: screenshot.fullUrl,
			recordedAt: screenshot.recordedAt,
			employeeId: screenshot.employeeId ?? slot?.employeeId,
			description: screenshot.description,
			isWorkRelated: screenshot.isWorkRelated
		};
	}
}
