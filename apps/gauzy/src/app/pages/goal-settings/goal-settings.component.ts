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
import { Store } from '../../@core/services/store.service';
import { EditKpiComponent } from './edit-kpi/edit-kpi.component';

@Component({
	selector: 'ga-goal-settings',
	templateUrl: './goal-settings.component.html'
})
export class GoalSettingsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	smartTableData = new LocalDataSource();
	smartTableSettings: object;
	selectedTimeFrame: any = null;
	selectedKPI: any = null;
	selectedTab = 'Set Time Frame';
	selectedOrganizationId: string;
	@ViewChild('smartTable') smartTable;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private goalSettingService: GoalSettingsService,
		private toastrService: NbToastrService,
		private store: Store
	) {
		super(translateService);
	}

	async ngOnInit() {
		this._loadTableSettings(null);
		this._applyTranslationOnSmartTable();
		await this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					await this._loadTableData(null);
				}
			});
	}

	tabChange(e) {
		this.selectedTab = e.tabTitle;
		this._loadTableSettings(e.tabTitle);
		this._applyTranslationOnSmartTable();
		this._loadTableData(e.tabTitle);
	}

	selectRow(ev: {
		data: any;
		isSelected: boolean;
		selected: any[];
		source: LocalDataSource;
	}) {
		if (ev.isSelected) {
			this.selectedTab === 'KPI'
				? (this.selectedKPI = ev.data)
				: (this.selectedTimeFrame = ev.data);
		} else {
			this.selectedTab === 'KPI'
				? (this.selectedKPI = null)
				: (this.selectedTimeFrame = null);
		}
	}

	private async _loadTableData(tab) {
		this.smartTableData.empty();
		const findObj = {
			organization: {
				id: this.selectedOrganizationId
			}
		};
		if (tab === 'KPI') {
			await this.goalSettingService.getAllKPI(findObj).then((res) => {
				this.smartTableData.load(res.items);
				if (this.smartTable) {
					this.smartTable.grid.dataSet.willSelect = 'false';
				}
			});
		} else {
			await this.goalSettingService
				.getAllTimeFrames(findObj)
				.then((res) => {
					this.smartTableData.load(res.items);
					if (this.smartTable) {
						this.smartTable.grid.dataSet.willSelect = 'false';
					}
				});
		}
	}

	private _loadTableSettings(tab) {
		if (tab === 'KPI') {
			this.smartTableSettings = {
				actions: false,
				columns: {
					name: {
						title: this.getTranslation('SM_TABLE.NAME'),
						type: 'string'
					},
					currentValue: {
						title: 'Current value',
						type: 'number',
						filter: false
					},
					targetValue: {
						title: 'Target value',
						type: 'number',
						filter: false
					},
					updatedAt: {
						title: 'Last Updated',
						type: 'custom',
						filter: false,
						renderComponent: DateViewComponent
					}
				}
			};
		} else {
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
	}

	async editTimeFrame(source) {
		if (source === 'add') {
			this.selectedTimeFrame = null;
			this.smartTable.grid.dataSet.willSelect = 'false';
		}
		const dialog = this.dialogService.open(EditTimeFrameComponent, {
			context: {
				timeFrame: this.selectedTimeFrame,
				type: source
			}
		});

		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			this._loadTableSettings(null);
			await this._loadTableData(null);
		}
	}

	async editKPI(source) {
		if (source === 'add') {
			this.selectedKPI = null;
			this.smartTable.grid.dataSet.willSelect = 'false';
		}
		const kpiDialog = this.dialogService.open(EditKpiComponent, {
			context: {
				selectedKPI: this.selectedKPI,
				type: source
			}
		});
		const response = kpiDialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			this._loadTableSettings('KPI');
			await this._loadTableData('KPI');
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
					.deleteTimeFrame(this.selectedTimeFrame.id)
					.then(async (res) => {
						if (res) {
							this.toastrService.danger(
								this.getTranslation(
									'TOASTR.MESSAGE.TIME_FRAME_DELETED'
								),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
							this._loadTableSettings(null);
							await this._loadTableData(null);
						}
					});
			}
		}
	}

	async deleteKPI() {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: 'Delete KPI',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService
					.deleteKPI(this.selectedKPI.id)
					.then(async (res) => {
						if (res) {
							this.toastrService.danger(
								'KPI Deleted',
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
							this._loadTableSettings('KPI');
							await this._loadTableData('KPI');
						}
					});
			}
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadTableSettings(null);
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
