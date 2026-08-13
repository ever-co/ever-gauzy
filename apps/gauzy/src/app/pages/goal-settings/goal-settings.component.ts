import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import { debounceTime, filter, firstValueFrom, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { GoalSettingsService, Store, ToastrService } from '@gauzy/ui-core/core';
import { ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	AlertModalComponent,
	DateViewComponent,
	GoalTemplatesComponent,
	IRecordViewSection,
	PaginationFilterBaseComponent,
	StatusBadgeComponent,
	ValueWithUnitComponent
} from '@gauzy/ui-core/shared';
import { EditKpiComponent } from './edit-kpi/edit-kpi.component';
import {
	ComponentLayoutStyleEnum,
	GoalOwnershipEnum,
	IGoalGeneralSetting,
	IKPI,
	IOrganization,
	KpiMetricEnum,
	KpiOperatorEnum
} from '@gauzy/contracts';
import { EditTimeFrameComponent } from './edit-time-frame/edit-time-frame.component';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-goal-settings',
    templateUrl: './goal-settings.component.html',
    styleUrls: ['./goal-settings.component.scss'],
    standalone: false
})
export class GoalSettingsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	smartTableData = new LocalDataSource();
	generalSettingsForm: UntypedFormGroup;
	smartTableSettings: object;
	selectedTimeFrame: any = null;
	selectedKPI: any = null;
	selectedTab: string;

	/*
	 * Read-only View: KPIs and Time Frames are both small records, so one
	 * right-side drawer serves the two tabs — the sections are rebuilt for the
	 * record's own tab each time one is opened.
	 */
	viewedRecord: any = null;
	viewHeading: string;
	viewSections: IRecordViewSection[] = [];

	selectedOrganizationId: string;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	disableButton = true;
	goalTimeFrames: any[];
	goalGeneralSettings: IGoalGeneralSetting;
	goalOwnershipEnum = GoalOwnershipEnum;
	preDefinedTimeFrames = [];
	public organization: IOrganization;
	public loading: boolean;
	private _goalSettings$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly goalSettingService: GoalSettingsService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly fb: UntypedFormBuilder
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
		this.store.selectedOrganization$.pipe(untilDestroyed(this)).subscribe(async (organization) => {
			if (organization) {
				this.organization = organization;
				this.selectedOrganizationId = organization.id;
				if (this.selectedTab) {
					this._refresh$.next(true);
					await this._loadTableData(this.selectedTab);
				}
			}
		});
		this.pagination$
			.pipe(
				distinctUntilChange(),
				tap(() => this._goalSettings$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._goalSettings$
			.pipe(
				debounceTime(100),
				filter(() => !!this.selectedTab),
				tap(async () => await this._loadTableData(this.selectedTab)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.goalTimeFrames = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.GOAL_SETTINGS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.goalTimeFrames = [])),
				tap(() => this._goalSettings$.next(true)),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.closeView();
				this.selectedKPI = null;
				this.selectedTimeFrame = null;
			});
	}

	async saveGeneralSettings() {
		await this.goalSettingService
			.updateGeneralSettings(this.goalGeneralSettings.id, this.generalSettingsForm.value)
			.then((res) => {
				if (res) {
					this.toastrService.success('TOASTR.MESSAGE.GOAL_GENERAL_SETTING_UPDATED');
					this._refresh$.next(true);
					this._loadTableData(null);
				}
			});
	}

	tabChange(e) {
		this.selectedTab = e.tabId;
		this._loadTableSettings(e.tabId);
		this._loadTableData(e.tabId);
		this._refresh$.next(true);
		this.smartTableData.empty();
		// The drawer's record belongs to the tab being left — close it.
		this.closeView();
		this.selectedKPI = null;
		this.selectedTimeFrame = null;
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

	/**
	 * Opens the read-only View of the selected KPI or Time Frame in the
	 * right-side drawer.
	 *
	 * @param selectedItem - Row the action was invoked from, when it came from the grid.
	 */
	view(selectedItem?: any): void {
		if (selectedItem) {
			this.selectRow({ isSelected: true, data: selectedItem });
		}

		if (this.selectedTab === 'kpi') {
			const kpi = selectedItem ?? this.selectedKPI;
			if (!kpi) {
				return;
			}
			this.viewHeading = 'GOALS_PAGE.SETTINGS.KPI';
			this.viewSections = this.buildKpiViewSections(kpi);
			this.viewedRecord = kpi;
		} else if (this.selectedTab === 'timeframe') {
			const timeFrame = selectedItem ?? this.selectedTimeFrame;
			if (!timeFrame) {
				return;
			}
			this.viewHeading = 'GOALS_PAGE.SETTINGS.TIME_FRAME_PAGE_TITLE';
			this.viewSections = this.buildTimeFrameViewSections();
			this.viewedRecord = timeFrame;
		}
	}

	closeView(): void {
		this.viewedRecord = null;
	}

	/**
	 * Field descriptors for a KPI — the grid columns, read vertically, then the
	 * fields the grid has no room for.
	 */
	private buildKpiViewSections(kpi: IKPI): IRecordViewSection[] {
		return [
			{
				fields: [
					{ label: 'SM_TABLE.NAME', key: 'name' },
					// The grid renders these through ValueWithUnitComponent — the
					// value followed by the KPI's unit — so the View reads the same.
					{ label: 'SM_TABLE.CURRENT_VALUE', value: this.withUnit(kpi.currentValue, kpi.unit) },
					{ label: 'SM_TABLE.TARGET_VALUE', value: this.withUnit(kpi.targetValue, kpi.unit) },
					{ label: 'SM_TABLE.LAST_UPDATED', key: 'updatedAt', type: 'date' }
				]
			},
			{
				fields: [
					{ label: 'FORM.LABELS.DESCRIPTION', key: 'description', type: 'multiline', wide: true },
					{
						label: 'GOALS_PAGE.FORM.LABELS.KPI_METRIC',
						value: this.translateEnum(kpi.type, KpiMetricEnum, 'GOALS_PAGE.KPI_METRIC')
					},
					{
						label: 'GOALS_PAGE.FORM.LABELS.KPI_SHOULD_BE',
						value: this.translateEnum(kpi.operator, KpiOperatorEnum, 'GOALS_PAGE.KPI_OPERATOR')
					},
					{ label: 'GOALS_PAGE.FORM.LABELS.LEAD', key: 'lead', type: 'person' }
				]
			}
		];
	}

	/**
	 * Field descriptors for a Time Frame — the grid columns, read vertically.
	 */
	private buildTimeFrameViewSections(): IRecordViewSection[] {
		return [
			{
				fields: [
					{ label: 'SM_TABLE.NAME', key: 'name' },
					{ label: 'SM_TABLE.START_DATE', key: 'startDate', type: 'date' },
					{ label: 'SM_TABLE.END_DATE', key: 'endDate', type: 'date' },
					// `status` was replaced by `statusMapper` when the rows were
					// loaded, so it is already the `{ text, class }` a badge expects.
					{ label: 'SM_TABLE.STATUS', key: 'status', type: 'badge' }
				]
			}
		];
	}

	/** Mirrors ValueWithUnitComponent: the value followed by the KPI's unit. */
	private withUnit(value: number, unit?: string): string | number | undefined {
		if (value === null || value === undefined) {
			return undefined;
		}
		return unit ? `${value} ${unit}` : value;
	}

	/**
	 * The record stores the enum VALUE ('Numerical', '>=') while the i18n keys
	 * are indexed by the enum KEY — reverse-map before translating.
	 */
	private translateEnum(value: string, enumType: Record<string, string>, i18nPrefix: string): string {
		const key = Object.keys(enumType).find((enumKey) => enumType[enumKey] === value);
		return key ? this.getTranslation(`${i18nPrefix}.${key}`) : value;
	}

	private async _loadTableData(tab) {
		this.loading = true;
		try {
			if (!this.organization) {
				return;
			}

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const findObj = {
				organization: {
					id: organizationId
				},
				tenantId
			};
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableData.setPaging(activePage, itemsPerPage, false);

			if (tab === 'kpi') {
				await this.goalSettingService.getAllKPI(findObj).then((res) => {
					this.smartTableData.load(res.items);
				});
			} else if (tab === 'timeframe') {
				await this.goalSettingService.getAllTimeFrames(findObj).then((res) => {
					if (!!res) {
						const mappedItems = [];
						res.items.map((item) => {
							item = Object.assign({}, item, {
								status: this.statusMapper(item.status)
							});
							mappedItems.push(item);
						});
						this.smartTableData.load(mappedItems);
					}
				});
			} else {
				await this.goalSettingService.getAllGeneralSettings(findObj).then((generalSettings) => {
					const { items } = generalSettings;
					this.goalGeneralSettings = items.pop();
					this.generalSettingsForm.patchValue({
						...this.goalGeneralSettings
					});
				});
			}
			this._loadGridLayoutData();
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableData.count()
			});
		} catch (error) {
			console.error('Error while retrieving goal settings', error);
			this.toastrService.danger(error);
		} finally {
			this.loading = false;
		}
	}

	private async _loadGridLayoutData() {
		if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
			this.goalTimeFrames.push(...(await this.smartTableData.getElements()));
		}
	}

	private _loadTableSettings(tab: string | null) {
		this.smartTableSettings = {
			actions: false,
			selectedRowIndex: -1,
			hideSubHeader: true,
			pager: {
				display: false
			}
		};
		if (tab === 'kpi') {
			this.smartTableSettings = {
				...this.smartTableSettings,
				noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.KPI'),
				columns: {
					name: {
						title: this.getTranslation('SM_TABLE.NAME'),
						type: 'string'
					},
					currentValue: {
						title: this.getTranslation('SM_TABLE.CURRENT_VALUE'),
						type: 'custom',
						isFilterable: false,
						renderComponent: ValueWithUnitComponent,
						componentInitFunction: (instance: ValueWithUnitComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						}
					},
					targetValue: {
						title: this.getTranslation('SM_TABLE.TARGET_VALUE'),
						type: 'custom',
						isFilterable: false,
						renderComponent: ValueWithUnitComponent,
						componentInitFunction: (instance: ValueWithUnitComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						}
					},
					updatedAt: {
						title: this.getTranslation('SM_TABLE.LAST_UPDATED'),
						type: 'custom',
						isFilterable: false,
						renderComponent: DateViewComponent,
						componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						}
					}
				}
			};
		} else if (tab === 'timeframe') {
			this.smartTableSettings = {
				...this.smartTableSettings,
				noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.TIME_FRAME'),
				columns: {
					name: {
						title: this.getTranslation('SM_TABLE.NAME'),
						type: 'string',
						width: '50%'
					},
					startDate: {
						title: this.getTranslation('SM_TABLE.START_DATE'),
						type: 'custom',
						isFilterable: false,
						renderComponent: DateViewComponent,
						componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						}
					},
					endDate: {
						title: this.getTranslation('SM_TABLE.END_DATE'),
						type: 'custom',
						isFilterable: false,
						renderComponent: DateViewComponent,
						componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						}
					},
					status: {
						title: this.getTranslation('SM_TABLE.STATUS'),
						type: 'custom',
						width: '5%',
						isFilterable: false,
						renderComponent: StatusBadgeComponent,
						componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
							instance.value = cell.getRawValue();
						}
					}
				}
			};
		}
	}

	async editTimeFrame(source, selectedItem?: any) {
		const preDefinedTimeFrames = this.preDefinedTimeFrames.filter((timeFrame) => {
			return this.goalTimeFrames.findIndex((goalTimeFrame) => goalTimeFrame.name === timeFrame.name) === -1;
		});
		if (source === 'add') {
			this.selectedTimeFrame = null;
		} else {
			if (selectedItem) {
				this.selectRow({
					isSelected: true,
					data: selectedItem
				});
			}
		}
		const dialog = this.dialogService.open(EditTimeFrameComponent, {
			context: {
				timeFrame: this.selectedTimeFrame,
				type: source,
				preDefinedTimeFrames: preDefinedTimeFrames
			},
			closeOnBackdropClick: false
		});

		const response = await firstValueFrom(dialog.onClose);
		this.clearItem();
		if (!!response) {
			this._loadTableSettings('timeframe');
			this._refresh$.next(true);
			await this._loadTableData('timeframe');
		}
	}

	async editKPI(source, selectedItem?: any) {
		if (source === 'add') {
			this.selectedKPI = null;
		} else {
			if (selectedItem) {
				this.selectRow({
					isSelected: true,
					data: selectedItem
				});
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
		this.clearItem();
		if (!!response) {
			this._refresh$.next(true);
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
				data: {
					title: this.translateService.instant('GOALS_PAGE.SETTINGS.DELETE_TIME_FRAME_TITLE'),
					message: this.translateService.instant('GOALS_PAGE.SETTINGS.DELETE_TIME_FRAME_CONFIRMATION'),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService.deleteTimeFrame(this.selectedTimeFrame.id).then(async (res) => {
					if (res) {
						this.toastrService.success('TOASTR.MESSAGE.TIME_FRAME_DELETED', {
							name: this.selectedTimeFrame.name
						});
						this.clearItem();
						this._refresh$.next(true);
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
				data: {
					title: this.translateService.instant('GOALS_PAGE.SETTINGS.DELETE_KPI_TITLE'),
					message: this.translateService.instant('GOALS_PAGE.SETTINGS.DELETE_KPI_CONFIRMATION'),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService.deleteKPI(this.selectedKPI.id).then(async (res) => {
					if (res) {
						this.toastrService.success('TOASTR.MESSAGE.KPI_DELETED');
						this.clearItem();
						this._refresh$.next(true);
						this._loadTableSettings('kpi');
						await this._loadTableData('kpi');
					}
				});
			}
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this._loadTableSettings(null);
		});
	}

	ngOnDestroy() {}

	async addTemplate() {
		const goalTemplateDialog = this.dialogService.open(GoalTemplatesComponent);
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
	 * Clear selected item
	 */
	clearItem() {
		// The list is about to be reloaded, so whatever the drawer is showing is
		// about to go stale — close it rather than leave a detached record open.
		this.closeView();
		this.selectRow({
			isSelected: false,
			data: null
		});
	}

	/**
	 *
	 * @param value
	 * @returns
	 */
	private statusMapper = (value: string): { text: string; class: string } => {
		const badgeClass = value === 'Active' ? 'success' : 'danger';
		const translatedText =
			value === 'Active'
				? this.getTranslation('PIPELINES_PAGE.ACTIVE')
				: this.getTranslation('PIPELINES_PAGE.INACTIVE');

		return {
			text: translatedText,
			class: badgeClass
		};
	};
}
