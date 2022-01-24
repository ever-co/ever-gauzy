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
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TimesheetService } from '../../timesheet.service';
import { GalleryItem } from '../../../gallery/gallery.directive';
import { distinctUntilChange, isEmpty, progressStatus, toLocal } from '@gauzy/common-angular';
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
	private _screenshots: IScreenshot[] = [];
	private _timeSlot: ITimeSlot;
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	progressStatus = progressStatus;

	@Input() selectionMode = false;
	@Input() galleryItems: GalleryItem[] = [];
	@Input() isSelected: boolean;

	@Output() delete: EventEmitter<any> = new EventEmitter();
	@Output() toggle: EventEmitter<any> = new EventEmitter();

	@Input()
	public get timeSlot(): ITimeSlot {
		return this._timeSlot;
	}
	public set timeSlot(timeSlot: ITimeSlot) {
		if (timeSlot) {
			timeSlot.localStartedAt = toLocal(timeSlot.startedAt).toDate();
			timeSlot.localStoppedAt = toLocal(timeSlot.stoppedAt).toDate();
			timeSlot.isAllowDelete = this.isEnableDelete(timeSlot);

			this._timeSlot = timeSlot;

			const screenshots = JSON.parse(
				JSON.stringify(timeSlot.screenshots)
			);
			this._screenshots = _.sortBy(screenshots, 'createdAt').reverse();
			if (this._screenshots.length) {
				const [last] = this._screenshots;
				this.lastScreenshot = last;
			}
		}
	}

	private _lastScreenshot: IScreenshot;
	public get lastScreenshot(): IScreenshot {
		return this._lastScreenshot;
	}
	public set lastScreenshot(screenshot: IScreenshot) {
		this._lastScreenshot = screenshot;
	}

	fallbackSvg = DEFAULT_SVG;

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
				tap((organization) => this.organization = organization),
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
		try {
			this.timesheetService.deleteTimeSlots([timeSlot.id]).then(() => {
				const { employee } = timeSlot;
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
				this.toastrService.success('TOASTR.MESSAGE.SCREENSHOT_DELETED', {
					name: `${employee.fullName.trim()}`,
					organization: this.organization.name
				});
				this.delete.emit();
			});	
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	viewInfo(timeSlot) {
		this.nbDialogService.open(ViewScreenshotsModalComponent, {
			context: { timeSlot }
		});
	}

	isEnableDelete(timeSlot: ITimeSlot): boolean {
		let isAllow: boolean = true;
		if (timeSlot.timeLogs.length > 0) {
			isAllow = !timeSlot.timeLogs.find((log: ITimeLog) =>
				isEmpty(log.stoppedAt)
			);
		}
		return isAllow;
	}

	ngOnDestroy(): void {}
}
