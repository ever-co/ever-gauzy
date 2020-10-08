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
import { ComponentEnum } from '../../@core/constants/layout.constants';
import {
	ComponentLayoutStyleEnum,
	GoalOwnershipEnum,
	IGoalGeneralSetting,
	IOrganization
} from '@gauzy/models';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { FormGroup, FormBuilder } from '@angular/forms';
import { GoalTemplatesComponent } from '../../@shared/goal/goal-templates/goal-templates.component';
import { ValueWithUnitComponent } from '../../@shared/table-components/value-with-units/value-with-units.component';

@Component({
	selector: 'ga-goal-settings',
	templateUrl: './goal-settings.component.html',
	styleUrls: ['./goal-settings.component.scss']
})
export class GoalSettingsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	smartTableData = new LocalDataSource();
	generalSettingsForm: FormGroup;
	smartTableSettings: object;
	selectedTimeFrame: any = null;
	selectedKPI: any = null;
	selectedTab: string;
	selectedOrganizationId: string;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	disableButton = true;
	goalTimeFrames: any[];
	goalGeneralSettings: IGoalGeneralSetting;
	goalOwnershipEnum = GoalOwnershipEnum;
	predefinedTimeFrames = [];
	@ViewChild('smartTable') smartTable;
	private _ngDestroy$ = new Subject<void>();
	organization: IOrganization;
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private goalSettingService: GoalSettingsService,
		private toastrService: NbToastrService,
		private store: Store,
		private router: Router,
		private fb: FormBuilder
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.generalSettingsForm = this.fb.group({
			maxObjectives: [],
			maxKeyResults: [],
			employeeCanCreateObjective: [true],
			canOwnObjectives: [],
			canOwnKeyResult: [],
			krTypeKPI: [true],
			krTypeTask: [true]
		});
		this._loadTableSettings(null);
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					this.organization = organization;
					this.selectedOrganizationId = organization.id;
					if (this.selectedTab) {
						await this._loadTableData(this.selectedTab || null);
					}
				}
			});
		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.GOAL_SETTINGS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedKPI = null;
				this.selectedTimeFrame = null;
			});
	}

	async saveGeneralSettings() {
		await this.goalSettingService
			.updateGeneralSettings(
				this.goalGeneralSettings.id,
				this.generalSettingsForm.value
			)
			.then((res) => {
				if (res) {
					this.toastrService.success(
						this.getTranslation(
							'TOASTR.MESSAGE.GOAL_GENERAL_SETTING_UPDATED'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._loadTableData(null);
				}
			});
	}

	tabChange(e) {
		this.selectedTab = e.tabId;
		this._loadTableSettings(e.tabId);
		this._loadTableData(e.tabId);
		if (this.smartTable) {
			this.selectedKPI = null;
			this.selectedTimeFrame = null;
			this.smartTable.grid.dataSet.willSelect = 'false';
		}
	}

	selectRow({ isSelected, data }) {
		if (isSelected) {
			this.selectedTab === 'KPI'
				? (this.selectedKPI = data)
				: (this.selectedTimeFrame = data);
		} else {
			this.selectedTab === 'KPI'
				? (this.selectedKPI = null)
				: (this.selectedTimeFrame = null);
		}
		if (this.smartTable) {
			this.smartTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
	}

	private async _loadTableData(tab) {
		if (!this.organization) {
			return;
		}

		this.smartTableData.empty();
		this.goalTimeFrames = [];
		const { id: organizationId, tenantId } = this.organization;
		const findObj = {
			organization: {
				id: organizationId
			},
			tenantId
		};

		if (tab === 'kpi') {
			await this.goalSettingService.getAllKPI(findObj).then((res) => {
				this.smartTableData.load(res.items);
				this.goalTimeFrames = res.items;
				if (this.smartTable) {
					this.smartTable.grid.dataSet.willSelect = 'false';
				}
			});
		} else if (tab === 'timeframe') {
			await this.goalSettingService
				.getAllTimeFrames(findObj)
				.then((res) => {
					if (!!res) {
						this.smartTableData.load(res.items);
						this.goalTimeFrames = res.items;
						if (this.smartTable) {
							this.smartTable.grid.dataSet.willSelect = 'false';
						}
					}
				});
		} else {
			await this.goalSettingService
				.getAllGeneralSettings(findObj)
				.then((generalSettings) => {
					const { items } = generalSettings;
					this.goalGeneralSettings = items.pop();
					this.generalSettingsForm.patchValue({
						...this.goalGeneralSettings
					});
				});
		}
	}

	private _loadTableSettings(tab: string | null) {
		if (tab === 'kpi') {
			this.smartTableSettings = {
				actions: false,
				columns: {
					name: {
						title: this.getTranslation('SM_TABLE.NAME'),
						type: 'string'
					},
					currentValue: {
						title: 'Current value',
						type: 'custom',
						filter: false,
						renderComponent: ValueWithUnitComponent
					},
					targetValue: {
						title: 'Target value',
						type: 'custom',
						filter: false,
						renderComponent: ValueWithUnitComponent
					},
					updatedAt: {
						title: 'Last Updated',
						type: 'custom',
						filter: false,
						renderComponent: DateViewComponent
					}
				}
			};
		} else if (tab === 'timeframe') {
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

	async editTimeFrame(source, selectedItem?: any) {
		const prdefTimeFrames = this.predefinedTimeFrames.filter(
			(timeFrame) => {
				return (
					this.goalTimeFrames.findIndex(
						(goalTimeFrame) => goalTimeFrame.name === timeFrame.name
					) === -1
				);
			}
		);
		if (selectedItem) {
			this.selectRow({
				isSelected: true,
				data: selectedItem
			});
			if (source === 'add') {
				this.selectedTimeFrame = null;
				this.smartTable.grid.dataSet.willSelect = 'false';
			}
		}
		const dialog = this.dialogService.open(EditTimeFrameComponent, {
			context: {
				timeFrame: this.selectedTimeFrame,
				type: source,
				predefinedTimeFrames: prdefTimeFrames
			},
			closeOnBackdropClick: false
		});

		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			this.cancel();
			this._loadTableSettings(null);
			await this._loadTableData(null);
		}
	}

	async editKPI(source, selectedItem?: any) {
		if (selectedItem) {
			this.selectRow({
				isSelected: true,
				data: selectedItem
			});
			if (source === 'add') {
				this.selectedKPI = null;
				this.smartTable.grid.dataSet.willSelect = 'false';
			}
		}
		const kpiDialog = this.dialogService.open(EditKpiComponent, {
			context: {
				selectedKPI: this.selectedKPI,
				type: source
			},
			closeOnBackdropClick: false
		});
		const response = await kpiDialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			this.cancel();
			this._loadTableSettings('kpi');
			await this._loadTableData('kpi');
		}
	}

	async deleteTimeFrame(selectedItem?: any) {
		if (selectedItem) {
			this.selectRow({
				isSelected: true,
				data: selectedItem
			});
		}
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: 'Delete Time Frame',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
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
							this.cancel();
							this._loadTableSettings(null);
							await this._loadTableData(null);
						}
					});
			}
		}
	}

	async deleteKPI(selectedItem?: any) {
		if (selectedItem) {
			this.selectRow({
				isSelected: true,
				data: selectedItem
			});
		}
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: 'Delete KPI',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
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
							this.cancel();
							this._loadTableSettings('kpi');
							await this._loadTableData('kpi');
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

	async addTemplate() {
		const goalTemplateDialog = this.dialogService.open(
			GoalTemplatesComponent
		);
		await goalTemplateDialog.onClose.pipe(first()).toPromise();
	}

	/*
	 * After add/edit/delete refresh selected row
	 */
	cancel(): void {
		this.selectRow({
			isSelected: false,
			data: null
		});
	}
}
