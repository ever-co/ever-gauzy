import {
	Component,
	OnInit,
	ViewChild,
	ViewChildren,
	QueryList,
	TemplateRef
} from '@angular/core';
import { TimeTrackerService } from 'apps/gauzy/src/app/@shared/time-tracker/time-tracker.service';
import {
	IGetTimeLogInput,
	TimeLog,
	Organization,
	IDateRange
} from '@gauzy/models';
import { toUTC, toLocal } from 'libs/utils';
import {
	NbCheckboxComponent,
	NbDialogService,
	NbDialogRef
} from '@nebular/theme';
import * as moment from 'moment';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { NgForm } from '@angular/forms';
import { DeleteConfirmComponent } from '../delete-confirm/delete-confirm.component';

@Component({
	selector: 'ngx-daily',
	templateUrl: './daily.component.html',
	styleUrls: ['./daily.component.scss']
})
export class DailyComponent implements OnInit {
	timeLogs: TimeLog[];
	today: Date = new Date();
	checkboxAll: boolean = false;
	selectedIds: string[] = [];
	private _selectedDate: Date = new Date();
	@ViewChild('checkAllCheckbox', { static: false })
	checkAllCheckbox: NbCheckboxComponent;
	@ViewChildren('otherCheckbox') otherCheckbox: QueryList<
		NbCheckboxComponent
	>;
	organization: Organization;
	addEditTimeRequest: any = {
		isBillable: true,
		projectId: null,
		taskId: null,
		description: ''
	};
	selectedRange: IDateRange = { start: null, end: null };

	bulkActionOptions = [
		{
			title: 'Delete'
		}
	];
	dialogRef: NbDialogRef<any>;

	constructor(
		private timeTrackerService: TimeTrackerService,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private store: Store
	) {}

	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
		this.getLogs(value);
	}
	async ngOnInit() {
		this.getLogs(this.today);
		this.store.selectedOrganization$.subscribe(
			(organization: Organization) => {
				this.organization = organization;
			}
		);
	}

	async getLogs(date: Date) {
		const startDate = moment(date).format('YYYY-MM-DD') + ' 00:00:00';
		const endDate = moment(date).format('YYYY-MM-DD') + ' 23:59:59';
		const request: IGetTimeLogInput = {
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
		};
		this.timeLogs = await this.timeTrackerService.getTimeLogs(request);
	}

	toggleCheckbox(is_checked: boolean, type: any) {
		if (type == 'all') {
			if (this.otherCheckbox) {
				this.otherCheckbox.forEach((otherCheckbox) => {
					otherCheckbox.checked = is_checked;
				});
			}
		} else {
			let all_checked = true;
			let any_checked = false;
			this.otherCheckbox.forEach((otherCheckbox) => {
				if (otherCheckbox.checked == false) {
					all_checked = false;
				} else {
					any_checked = true;
				}
			});

			if (all_checked) {
				this.checkAllCheckbox.checked = true;
			} else if (any_checked) {
				this.checkAllCheckbox.indeterminate = any_checked;
			} else {
				this.checkAllCheckbox.checked = false;
			}
		}
	}

	addTime(f: NgForm) {
		if (!f.valid) {
			return;
		}
		const startedAt = toUTC(this.selectedRange.start).toDate();
		const stoppedAt = toUTC(this.selectedRange.end).toDate();

		let addRequestData = {
			startedAt,
			stoppedAt,
			isBillable: this.addEditTimeRequest.isBillable,
			projectId: this.addEditTimeRequest.projectId,
			taskId: this.addEditTimeRequest.taskId,
			description: this.addEditTimeRequest.description
		};

		(this.addEditTimeRequest.id
			? this.timeTrackerService.updateTime(
					this.addEditTimeRequest.id,
					addRequestData
			  )
			: this.timeTrackerService.addTime(addRequestData)
		)
			.then(() => {
				this.getLogs(this.selectedDate);
				f.resetForm();
				this.dialogRef.close();
				this.selectedRange = { start: null, end: null };
				this.toastrService.success('TIMER_TRACKER.ADD_TIME_SUCCESS');
			})
			.catch((error) => {
				this.toastrService.danger(error);
			});
	}

	openEdit(dialog: TemplateRef<any>, timeLog: TimeLog) {
		this.addEditTimeRequest = Object.assign({}, timeLog);
		this.selectedRange = {
			start: toLocal(timeLog.startedAt).toDate(),
			end: toLocal(timeLog.stoppedAt).toDate()
		};
		this.dialogRef = this.dialogService.open(dialog, { context: timeLog });
	}

	onDeleteConfirm(log) {
		this.dialogService
			.open(DeleteConfirmComponent)
			.onClose.subscribe((type) => {
				if (type == 'ok') {
					this.timeTrackerService.deleteLogs(log.id).then(() => {
						let index = this.timeLogs.indexOf(log);
						this.timeLogs.splice(index, 1);
					});
				}
			});
	}

	bulkAction(action) {
		console.log(this.otherCheckbox, this.selectedIds);

		// this.otherCheckbox.forEach(otherCheckbox => {
		// 	if (otherCheckbox.checked == true) {
		// 		selectedIds.push(otherCheckbox.value);
		// 	}
		// });
		console.log(action, this.otherCheckbox);
	}
}
