import { Component, OnInit, Input, OnDestroy, Output, EventEmitter } from '@angular/core';
import { ITimeSlot, IScreenshot, ITimeLog, IOrganization, IEmployee, TimeFormatEnum } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { filter, take, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { sortBy } from 'underscore';
import { DEFAULT_SVG } from '@gauzy/ui-sdk/common';
import { distinctUntilChange, isNotEmpty, progressStatus } from '@gauzy/ui-sdk/common';
import { TimesheetService } from '../../timesheet.service';
import { GalleryItem } from '../../../gallery/gallery.directive';
import { ViewScreenshotsModalComponent } from '../view-screenshots-modal/view-screenshots-modal.component';
import { GalleryService } from '../../../gallery/gallery.service';
import { ErrorHandlingService, Store, ToastrService } from './../../../../@core/services';
import { TimeZoneService } from '../../gauzy-filters/timezone-filter';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-screenshots-item',
	templateUrl: './screenshots-item.component.html',
	styleUrls: ['./screenshots-item.component.scss']
})
export class ScreenshotsItemComponent implements OnInit, OnDestroy {
	public isShowBorder: boolean = false;
	public organization: IOrganization;
	progressStatus = progressStatus;
	fallbackSvg = DEFAULT_SVG;

	/*
	 * Getter & Setter for dynamic enabled/disabled element
	 */
	_employees: IEmployee[] = [];
	get employees(): IEmployee[] {
		return this._employees;
	}
	@Input() set employees(employees: IEmployee[]) {
		this._employees = employees;
	}

	@Input() multiple: boolean = true;
	@Input() selectionMode = false;
	@Input() galleryItems: GalleryItem[] = [];
	@Input() isSelected: boolean;
	@Input() employeeId: IEmployee['id'];

	@Output() delete: EventEmitter<any> = new EventEmitter();
	@Output() toggle: EventEmitter<any> = new EventEmitter();

	/*
	 * Getter & Setter for TimeSlot
	 */
	private _timeSlot: ITimeSlot;
	get timeSlot(): ITimeSlot {
		return this._timeSlot;
	}
	@Input() set timeSlot(timeSlot: ITimeSlot) {
		if (!timeSlot) return; // If timeSlot is falsy, return early

		// Create a deep copy of the screenshots to avoid modifying the original array
		let screenshots = JSON.parse(JSON.stringify(timeSlot.screenshots));

		// Map each screenshot with additional properties and employeeId
		this.screenshots =
			screenshots.map((screenshot: IScreenshot) => ({
				employeeId: timeSlot.employeeId,
				...screenshot
			})) || [];

		if (isNotEmpty(this.screenshots)) {
			// Check if all screenshots have isWorkRelated as false
			this.isShowBorder = this.screenshots.every((screenshot: IScreenshot) => screenshot.isWorkRelated === false);
		}

		// Assign a new object to _timeSlot with modified properties
		this._timeSlot = {
			...timeSlot,
			isAllowDelete: this.isEnableDelete(timeSlot),
			screenshots: this.screenshots
		};

		// Sort screenshots by recordedAt in descending order
		screenshots = sortBy(screenshots, 'recordedAt').reverse();

		// Update lastScreenshot with the first screenshot if available
		this.lastScreenshot = screenshots.length > 0 ? screenshots[0] : null;
	}

	/*
	 * Getter & Setter for Screenshots
	 */
	private _screenshots: IScreenshot[] = [];
	get screenshots(): IScreenshot[] {
		return this._screenshots;
	}
	set screenshots(screenshots: IScreenshot[]) {
		this._screenshots = screenshots;
	}

	/*
	 * Getter & Setter for Screenshot
	 */
	private _lastScreenshot: IScreenshot;
	get lastScreenshot(): IScreenshot {
		return this._lastScreenshot;
	}
	set lastScreenshot(screenshot: IScreenshot) {
		this._lastScreenshot = screenshot;
	}

	@Input() timezone: string = this.timeZoneService.currentTimeZone;
	@Input() timeformat: TimeFormatEnum = TimeFormatEnum.FORMAT_12_HOURS;

	constructor(
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetService: TimesheetService,
		private readonly galleryService: GalleryService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly store: Store,
		private readonly timeZoneService: TimeZoneService
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Toggles the selection of a time slot.
	 * If the time slot allows deletion, it emits the time slot's ID.
	 *
	 * @param {ITimeSlot} timeSlot - The time slot to toggle.
	 */
	toggleSelect(timeSlot: ITimeSlot): void {
		if (timeSlot.isAllowDelete) {
			const slotId = timeSlot.id;
			this.toggle.emit(slotId);
		}
	}

	/**
	 * Deletes a time slot if deletion is allowed and handles related tasks.
	 *
	 * @param timeSlot The time slot to be deleted.
	 */
	async deleteSlot(timeSlot: ITimeSlot): Promise<void> {
		if (!timeSlot.isAllowDelete) {
			return;
		}

		try {
			const { id: organizationId, tenantId } = this.organization;
			const request = {
				ids: [timeSlot.id],
				organizationId,
				tenantId
			};

			// Delete time slots
			await this.timesheetService.deleteTimeSlots(request);

			// Remove related screenshots from the gallery
			const screenshotsToRemove = timeSlot.screenshots.map((screenshot) => ({
				thumbUrl: screenshot.thumbUrl,
				fullUrl: screenshot.fullUrl,
				...screenshot
			}));
			this.galleryService.removeGalleryItems(screenshotsToRemove);

			// Display success message
			const employeeName = timeSlot.employee?.fullName?.trim() || 'Unknown Employee';

			this.toastrService.success('TOASTR.MESSAGE.SCREENSHOT_DELETED', {
				name: employeeName,
				organization: this.organization.name
			});

			// Trigger delete event
			this.delete.emit();
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	/**
	 * Opens a modal to view information about the provided time slot.
	 *
	 * @param timeSlot - The time slot for which information is to be viewed.
	 */
	viewInfo(timeSlot: ITimeSlot): void {
		const dialog$ = this.nbDialogService.open(ViewScreenshotsModalComponent, {
			context: {
				timeSlot,
				timeLogs: timeSlot.timeLogs
			}
		});
		dialog$.onClose
			.pipe(
				filter((data) => Boolean(data && data['isDelete'])),
				tap(() => this.delete.emit()),
				take(1),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Checks if the provided time slot can be deleted based on certain conditions.
	 *
	 * @param timeSlot - The time slot to be checked for deletion.
	 * @returns True if deletion is allowed, false otherwise.
	 */
	isEnableDelete(timeSlot: ITimeSlot): boolean {
		return timeSlot.timeLogs.every((log: ITimeLog) => !log.isRunning);
	}

	ngOnDestroy(): void {}
}
