import {
	Component,
	OnInit,
	Input,
	OnDestroy,
	Output,
	EventEmitter
} from '@angular/core';
import {
	OrganizationPermissionsEnum,
	ITimeSlot,
	IScreenshot,
	ITimeLog,
	IOrganization
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { filter, take, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TimesheetService } from '../../timesheet.service';
import { GalleryItem } from '../../../gallery/gallery.directive';
import { distinctUntilChange, progressStatus, toLocal } from '@gauzy/common-angular';
import { ViewScreenshotsModalComponent } from '../view-screenshots-modal/view-screenshots-modal.component';
import * as _ from 'underscore';
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
	
	public organization: IOrganization;
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	progressStatus = progressStatus;
	fallbackSvg = DEFAULT_SVG;

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
			let screenshots = JSON.parse(JSON.stringify(timeSlot.screenshots));
			this.screenshots = screenshots.map((screenshot: IScreenshot) => {
				return {
					employeeId: timeSlot.employeeId,
					...screenshot
				}
			}); 
			this._timeSlot = Object.assign({}, timeSlot, {
				localStartedAt: toLocal(timeSlot.startedAt).toDate(),
				localStoppedAt: toLocal(timeSlot.stoppedAt).toDate(),
				isAllowDelete: this.isEnableDelete(timeSlot),
				screenshots: this.screenshots
			});
			screenshots = _.sortBy(screenshots, 'createdAt').reverse();
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
	) {}

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

	deleteSlot(timeSlot: ITimeSlot) {
		if (!timeSlot.isAllowDelete) {
			return;
		}
		try {
			this.timesheetService.deleteTimeSlots([timeSlot.id]).then(() => {
				const screenshots = this._screenshots.map(
					(screenshot: IScreenshot) => {
						return {
							thumbUrl: screenshot.thumbUrl,
							fullUrl: screenshot.fullUrl,
							...screenshot
						};
					}
				);
				this.galleryService.removeGalleryItems(screenshots);

				const { employee } = timeSlot;
				if (employee && employee.fullName) {
					this.toastrService.success('TOASTR.MESSAGE.SCREENSHOT_DELETED', {
						name: `${employee.fullName.trim()}`,
						organization: this.organization.name
					});
				}
				this.delete.emit();
			});	
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	/**
	 * View Time Slot Info
	 * 
	 * @param timeSlot 
	 */
	viewInfo(timeSlot) {
		this.nbDialogService.open(ViewScreenshotsModalComponent, {
			context: { timeSlot }
		})
		.onClose
		.pipe(
			filter(Boolean),
			tap((data) => {
				if (data && data['isDelete']) {
					this.delete.emit();
				}
			}),
			take(1),
			untilDestroyed(this)
		)
		.subscribe();
	}

	isEnableDelete(timeSlot: ITimeSlot): boolean {
		let isAllow: boolean = true;
		if (timeSlot.timeLogs.length > 0) {
			isAllow = !timeSlot.timeLogs.find((log: ITimeLog) => log.isRunning);
		}
		return isAllow;
	}

	ngOnDestroy(): void {}
}
