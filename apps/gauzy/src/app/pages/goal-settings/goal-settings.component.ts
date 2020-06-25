import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EditTimeFrameComponent } from './edit-time-frame/edit-time-frame.component';
import { first, takeUntil } from 'rxjs/operators';
import { GoalSettingsService } from '../../@core/services/goal-settings.service';
import { Subject } from 'rxjs';
import { AlertModalComponent } from '../../@shared/alert-modal/alert-modal.component';

@Component({
	selector: 'ga-goal-settings',
	templateUrl: './goal-settings.component.html',
	styleUrls: ['./goal-settings.component.scss']
})
export class GoalSettingsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	smartTableData = new LocalDataSource();
	smartTableSettings: object;
	selectedTimeFrame: any = null;
	@ViewChild('timeFrameTable') timeFrameTable;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private goalSettingService: GoalSettingsService,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this._loadTableSettings();
		this._applyTranslationOnSmartTable();
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
					title: this.getTranslation('SM_TABLE.NAME'),
					type: 'string'
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'string',
					filter: false
				},
				startDate: {
					title: this.getTranslation('SM_TABLE.START_DATE'),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent
				},
				endDate: {
					title: this.getTranslation('SM_TABLE.END_DATE'),
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
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: 'Delete Time Frame',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService
					.delete(this.selectedTimeFrame.id)
					.then(async (res) => {
						if (res) {
							this.toastrService.danger(
								this.getTranslation(
									'TOASTR.MESSAGE.TIME_FRAME_DELETED'
								),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
							this._loadTableSettings();
							await this._loadTableData();
						}
					});
			}
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadTableSettings();
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
