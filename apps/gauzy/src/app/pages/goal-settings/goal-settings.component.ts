import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { EditTimeFrameComponent } from './edit-time-frame/edit-time-frame.component';
import { first } from 'rxjs/operators';
import { GoalSettingsService } from '../../@core/services/goal-settings.service';

@Component({
	selector: 'ga-goal-settings',
	templateUrl: './goal-settings.component.html',
	styleUrls: ['./goal-settings.component.scss']
})
export class GoalSettingsComponent extends TranslationBaseComponent
	implements OnInit {
	smartTableData = new LocalDataSource();
	smartTableSettings: object;
	selectedTimeFrame: any = null;
	@ViewChild('timeFrameTable') timeFrameTable;
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private goalSettingService: GoalSettingsService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this._loadTableSettings();
		this._loadTableData();
	}

	selectTimeFrame(ev: {
		data: any;
		isSelected: boolean;
		selected: any[];
		source: LocalDataSource;
	}) {
		if (ev.isSelected) {
			this.selectedTimeFrame = ev.data;
		} else {
			this.selectedTimeFrame = null;
		}
	}

	private async _loadTableData() {
		await this.goalSettingService.getAllTimeFrames().then((res) => {
			this.smartTableData.load(res.items);
			if (this.timeFrameTable) {
				this.timeFrameTable.grid.dataSet.willSelect = 'false';
			}
		});
	}

	private _loadTableSettings() {
		this.smartTableSettings = {
			actions: false,
			columns: {
				name: {
					title: 'Name',
					type: 'string'
				},
				status: {
					title: 'Status',
					type: 'string',
					filter: false
				},
				startDate: {
					title: 'Start Date',
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent
				},
				endDate: {
					title: 'End Date',
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent
				}
			}
		};
	}

	async editTimeFrame(source) {
		if (source === 'add') {
			this.selectedTimeFrame = null;
			this.timeFrameTable.grid.dataSet.willSelect = 'false';
		}
		const dialog = this.dialogService.open(EditTimeFrameComponent, {
			context: {
				timeFrame: this.selectedTimeFrame,
				type: source
			}
		});

		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			this._loadTableSettings();
			await this._loadTableData();
		}
	}

	async deleteTimeFrame() {
		await this.goalSettingService
			.delete(this.selectedTimeFrame.id)
			.then(async (res) => {
				if (res) {
					this._loadTableSettings();
					await this._loadTableData();
				}
			});
	}
}
