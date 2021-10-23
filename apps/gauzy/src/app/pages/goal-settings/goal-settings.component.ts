import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { EditTimeFrameComponent } from './edit-time-frame/edit-time-frame.component';
import { tap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { GoalSettingsService } from '../../@core/services/goal-settings.service';
import { AlertModalComponent } from '../../@shared/alert-modal/alert-modal.component';
import { Store } from '../../@core/services/store.service';
import { EditKpiComponent } from './edit-kpi/edit-kpi.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import {
	ComponentLayoutStyleEnum,
	GoalOwnershipEnum,
	IGoalGeneralSetting,
	IOrganization
} from '@gauzy/contracts';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { FormGroup, FormBuilder } from '@angular/forms';
import { GoalTemplatesComponent } from '../../@shared/goal/goal-templates/goal-templates.component';
import { ValueWithUnitComponent } from '../../@shared/table-components/value-with-units/value-with-units.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-goal-settings',
	templateUrl: './goal-settings.component.html',
	styleUrls: ['./goal-settings.component.scss']
})
export class GoalSettingsComponent
	extends TranslationBaseComponent
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
	loading: boolean;

	goalSettingsTable: Ng2SmartTableComponent;
	@ViewChild('goalSettingsTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.goalSettingsTable = content;
			this.onChangedSource();
		}
	}
	organization: IOrganization;
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private goalSettingService: GoalSettingsService,
		private toastrService: ToastrService,
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
			.pipe(untilDestroyed(this))
			.subscribe(async (organization) => {
				if (organization) {
					this.organization = organization;
					this.selectedOrganizationId = organization.id;
					if (this.selectedTab) {
						await this._loadTableData(this.selectedTab);
					}
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
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
			.pipe(untilDestroyed(this))
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
						'TOASTR.MESSAGE.GOAL_GENERAL_SETTING_UPDATED'
					);
					this._loadTableData(null);
				}
			});
	}

	tabChange(e) {
		this.selectedTab = e.tabId;
		this._loadTableSettings(e.tabId);
		this._loadTableData(e.tabId);
		if (this.goalSettingsTable) {
			this.selectedKPI = null;
			this.selectedTimeFrame = null;
		}
	}

	selectRow({ isSelected, data }) {
		this.selectedKPI = null;
		this.selectedTimeFrame = null;
		if (isSelected) {
			if (this.selectedTab === 'kpi') {
				this.selectedKPI = data;
			} else if (this.selectedTab === 'timeframe') {
				this.selectedTimeFrame = data;
			}
		}
		this.disableButton = !isSelected;
	}

	private async _loadTableData(tab) {
		this.loading = true;
		if (!this.organization) {
			return;
		}

		this.smartTableData.empty();
		this.goalTimeFrames = [];
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
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
			});
		} else if (tab === 'timeframe') {
			await this.goalSettingService
				.getAllTimeFrames(findObj)
				.then((res) => {
					if (!!res) {
						this.smartTableData.load(res.items);
						this.goalTimeFrames = res.items;
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
		this.loading = false;
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
						title: this.getTranslation('SM_TABLE.CURRENT_VALUE'),
						type: 'custom',
						filter: false,
						renderComponent: ValueWithUnitComponent
					},
					targetValue: {
						title: this.getTranslation('SM_TABLE.TARGET_VALUE'),
						type: 'custom',
						filter: false,
						renderComponent: ValueWithUnitComponent
					},
					updatedAt: {
						title: this.getTranslation('SM_TABLE.LAST_UPDATED'),
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

		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			this.clearItem();
			this._loadTableSettings('timeframe');
			await this._loadTableData('timeframe');
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
			}
		}
		const kpiDialog = this.dialogService.open(EditKpiComponent, {
			context: {
				selectedKPI: this.selectedKPI,
				type: source
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(kpiDialog.onClose);
		if (!!response) {
			this.clearItem();
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
					title: this.translateService.instant(
						'GOALS_PAGE.SETTINGS.DELETE_TIME_FRAME_TITLE'
					),
					message: this.translateService.instant(
						'GOALS_PAGE.SETTINGS.DELETE_TIME_FRAME_CONFIRMATION'
					),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService
					.deleteTimeFrame(this.selectedTimeFrame.id)
					.then(async (res) => {
						if (res) {
							this.toastrService.success(
								'TOASTR.MESSAGE.TIME_FRAME_DELETED',
								{ name: this.selectedTimeFrame.name }
							);
							this.clearItem();
							this._loadTableSettings('timeframe');
							await this._loadTableData('timeframe');
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
					title: this.translateService.instant(
						'GOALS_PAGE.SETTINGS.DELETE_KPI_TITLE'
					),
					message: this.translateService.instant(
						'GOALS_PAGE.SETTINGS.DELETE_KPI_CONFIRMATION'
					),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService
					.deleteKPI(this.selectedKPI.id)
					.then(async (res) => {
						if (res) {
							this.toastrService.success(
								'TOASTR.MESSAGE.KPI_DELETED'
							);
							this.clearItem();
							this._loadTableSettings('kpi');
							await this._loadTableData('kpi');
						}
					});
			}
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this._loadTableSettings(null);
			});
	}

	ngOnDestroy() {}

	async addTemplate() {
		const goalTemplateDialog = this.dialogService.open(
			GoalTemplatesComponent
		);
		await firstValueFrom(goalTemplateDialog.onClose);
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

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.goalSettingsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectRow({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.goalSettingsTable && this.goalSettingsTable.grid) {
			this.goalSettingsTable.grid.dataSet['willSelect'] = 'false';
			this.goalSettingsTable.grid.dataSet.deselectAll();
		}
	}
}
