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
import { untilDestroyed } from 'ngx-take-until-destroy';
import { TimesheetService } from '../../timesheet.service';
import { DeleteConfirmationComponent } from '../../../user/forms/delete-confirmation/delete-confirmation.component';
import { GalleryItem } from '../../../gallery/gallery.directive';
import { ViewTimeLogModalComponent } from '../../view-time-log-modal/view-time-log-modal/view-time-log-modal.component';

@Component({
	selector: 'ngx-screenshots-item',
	templateUrl: './screenshots-item.component.html',
	styleUrls: ['./screenshots-item.component.scss']
})
export class ScreenshotsItemComponent implements OnInit, OnDestroy {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	@Input() timeSlot: TimeSlot;
	@Input() selectionMode = false;
	@Input() galleryItems: GalleryItem[] = [];
	@Input() isSelected: boolean;

	@Output() delete: EventEmitter<any> = new EventEmitter();
	@Output() toggle: EventEmitter<any> = new EventEmitter();

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
		this.nbDialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(untilDestroyed(this))
			.subscribe((type) => {
				if (type === 'ok') {
					this.timesheetService
						.deleteTimeSlots([timeSlot.id])
						.then(() => {
							this.delete.emit();
						});
				}
			});
	}

	viewInfo(timeSlot) {
		if (timeSlot.timeLogs.length > 0) {
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
