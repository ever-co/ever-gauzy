import {
	Component,
	OnInit,
	Input,
	OnDestroy,
	Output,
	EventEmitter
} from '@angular/core';
import {
	ITimeSlot,
	IScreenshot,
	ITimeLog,
	IOrganization,
	IEmployee
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { filter, take, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { sortBy } from 'underscore';
import { TimesheetService } from '../../timesheet.service';
import { GalleryItem } from '../../../gallery/gallery.directive';
import { distinctUntilChange, isNotEmpty, progressStatus, toLocal } from '@gauzy/common-angular';
import { ViewScreenshotsModalComponent } from '../view-screenshots-modal/view-screenshots-modal.component';
import { GalleryService } from '../../../gallery/gallery.service';
import { DEFAULT_SVG } from './../../../../@core/constants/app.constants';
import { ErrorHandlingService, Store, ToastrService } from './../../../../@core/services';

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
		if (timeSlot) {
			// Create a deep copy of the screenshots to avoid modifying the original array
			let screenshots = JSON.parse(JSON.stringify(timeSlot.screenshots));

			// Map each screenshot with additional properties and employeeId
			this.screenshots = screenshots.map((screenshot: IScreenshot) => ({
				employeeId: timeSlot.employeeId,
				...screenshot
			}));

			if (isNotEmpty(this.screenshots)) {
				// Check if all screenshots have isWorkRelated as false
				this.isShowBorder = this.screenshots.every(
					(screenshot: IScreenshot) => screenshot.isWorkRelated === false
				);
			}

			// Assign a new object to _timeSlot with modified properties
			this._timeSlot = Object.assign({}, timeSlot, {
				localStartedAt: toLocal(timeSlot.startedAt).toDate(),
				localStoppedAt: toLocal(timeSlot.stoppedAt).toDate(),
				isAllowDelete: this.isEnableDelete(timeSlot),
				screenshots: this.screenshots
			});

			// Sort screenshots by recordedAt in descending order
			screenshots = sortBy(screenshots, 'recordedAt').reverse();

			// Update lastScreenshot with the first screenshot if available
			if (screenshots.length) {
				const [last] = screenshots;
				this.lastScreenshot = last;
			}
		}
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

	constructor(
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetService: TimesheetService,
		private readonly galleryService: GalleryService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly store: Store
	) { }

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
	}

	toggleSelect(timeSlot: ITimeSlot): void {
		if (timeSlot.isAllowDelete) {
			const slotId = timeSlot.id;
			this.toggle.emit(slotId);
		}
	}

	/**
 * Deletes a time slot if deletion is allowed and handles related tasks.
 *
 * @param timeSlot - The time slot to be deleted.
 */
	async deleteSlot(timeSlot: ITimeSlot): Promise<void> {
		if (!timeSlot.isAllowDelete) {
			return;
		}

		try {
			const { id: organizationId } = this.organization;
			const request = {
				ids: [timeSlot.id],
				organizationId
			};

			// Delete time slots
			await this.timesheetService.deleteTimeSlots(request);

			// Remove related screenshots from the gallery
			const screenshots = this._screenshots.map(({ thumbUrl, fullUrl, ...screenshot }) => ({
				thumbUrl,
				fullUrl,
				...screenshot
			}));
			this.galleryService.removeGalleryItems(screenshots);

			// Display success message
			const { employee } = timeSlot;
			if (employee && employee.fullName) {
				this.toastrService.success('TOASTR.MESSAGE.SCREENSHOT_DELETED', {
					name: employee.fullName.trim(),
					organization: this.organization.name
				});
			}

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
		this.nbDialogService.open(ViewScreenshotsModalComponent, {
			context: {
				timeSlot,
				timeLogs: timeSlot.timeLogs
			}
		})
			.onClose.pipe(
				filter(data => Boolean(data && data['isDelete'])),
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

	ngOnDestroy(): void { }
}
