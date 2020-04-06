import {
	Component,
	OnInit,
	ViewChild,
	ViewChildren,
	QueryList
} from '@angular/core';
import { TimeTrackerService } from 'apps/gauzy/src/app/@shared/time-tracker/time-tracker.service';
import { IGetTimeLogInput, TimeLog } from '@gauzy/models';
import { toUTC } from 'libs/utils';
import { NbCheckboxComponent, NbDialogService } from '@nebular/theme';
import * as moment from 'moment';
import { EditTimeLogDialogComponent } from '../edit-time-log-dialog/edit-time-log-dialog.component';

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

	bulkActionOptions = [
		{
			title: 'Delete'
		}
	];
	constructor(
		private timeTrackerService: TimeTrackerService,
		private dialogService: NbDialogService
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

	openEdit(timeLog: TimeLog) {
		this.dialogService.open(EditTimeLogDialogComponent, {
			context: {
				timeLog
			}
		});
	}

	onDeleteConfirm(event) {
		if (window.confirm('Are you sure you want to delete?')) {
			event.confirm.resolve();
		} else {
			event.confirm.reject();
		}
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
