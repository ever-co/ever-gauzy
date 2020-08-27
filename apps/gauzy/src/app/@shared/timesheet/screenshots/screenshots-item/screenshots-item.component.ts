import {
	Component,
	OnInit,
	Input,
	OnDestroy,
	Output,
	EventEmitter
} from '@angular/core';
import { OrganizationPermissionsEnum, TimeSlot, TimeLog } from '@gauzy/models';
import { NbDialogService } from '@nebular/theme';
import { TimesheetService } from '../../timesheet.service';
import { GalleryItem } from '../../../gallery/gallery.directive';
import { ViewTimeLogModalComponent } from '../../view-time-log-modal/view-time-log-modal/view-time-log-modal.component';
import { toLocal } from 'libs/utils';

@Component({
	selector: 'ngx-screenshots-item',
	templateUrl: './screenshots-item.component.html',
	styleUrls: ['./screenshots-item.component.scss']
})
export class ScreenshotsItemComponent implements OnInit, OnDestroy {
	private _timeSlot: TimeSlot;
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;

	@Input() selectionMode = false;
	@Input() galleryItems: GalleryItem[] = [];
	@Input() isSelected: boolean;

	@Output() delete: EventEmitter<any> = new EventEmitter();
	@Output() toggle: EventEmitter<any> = new EventEmitter();

	@Input()
	public get timeSlot(): TimeSlot {
		return this._timeSlot;
	}
	public set timeSlot(timeSlot: TimeSlot) {
		if (timeSlot) {
			timeSlot.localStartedAt = toLocal(timeSlot.startedAt).toDate();
			timeSlot.localStoppedAt = toLocal(timeSlot.stoppedAt).toDate();
		}
		this._timeSlot = timeSlot;
	}
	constructor(
		private nbDialogService: NbDialogService,
		private timesheetService: TimesheetService
	) {}

	ngOnInit(): void {}

	toggleSelect(slotId): void {
		this.toggle.emit(slotId);
	}

	prgressStatus(value) {
		if (value <= 25) {
			return 'danger';
		} else if (value <= 50) {
			return 'warning';
		} else if (value <= 75) {
			return 'info';
		} else {
			return 'success';
		}
	}

	deleteSlot(timeSlot) {
		this.timesheetService.deleteTimeSlots([timeSlot.id]).then(() => {
			this.delete.emit();
		});
	}

	viewInfo(timeSlot) {
		if (timeSlot.timeLogs && timeSlot.timeLogs.length > 0) {
			const findOptions = {
				relations: ['employee', 'employee.user', 'project', 'task']
			};
			this.timesheetService
				.getTimeLog(timeSlot.timeLogs[0].id, findOptions)
				.then((timeLog: TimeLog) => {
					this.nbDialogService.open(ViewTimeLogModalComponent, {
						context: { timeLog },
						dialogClass: 'view-log-dialog'
					});
				});
		}
	}

	ngOnDestroy(): void {}
}
