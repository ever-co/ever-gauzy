import { Component, OnInit, OnDestroy, TemplateRef } from '@angular/core';
import { IEmployeeLevelInput, ITag, ComponentLayoutStyleEnum, IOrganization } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { LocalDataSource } from 'angular2-smart-table';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../@shared/pagination/pagination-filter-base.component';
import { EmployeeLevelService, Store, ToastrService } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-level',
	templateUrl: './employee-level.component.html',
	styleUrls: ['employee-level.component.scss']
})
export class EmployeeLevelComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	organization: IOrganization;
	showAddCard: boolean;
	showEditDiv: boolean;

	employeeLevels: IEmployeeLevelInput[] = [];
	selectedEmployeeLevel: IEmployeeLevelInput;
	tags: ITag[] = [];
	isGridEdit: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	disabled: boolean = true;
	loading: boolean = false;
	selected = {
		employeeLevel: null,
		state: false
	};
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly employeeLevelService: EmployeeLevelService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this.loadEmployeeLevels()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				tap(() => this.refreshPagination()),
				tap(() => (this.employeeLevels = [])),
				untilDestroyed(this)
			)
			.subscribe();
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	ngOnDestroy(): void {}

	private async loadEmployeeLevels() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { activePage, itemsPerPage } = this.getPagination();

		const { items } = await this.employeeLevelService.getAll(['tags'], {
			tenantId,
			organizationId
		});
		if (items) {
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			this.smartTableSource.load(items);
			if (this._isGridLayout) {
				this._loadGridLayoutData();
			} else this.employeeLevels = items;
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableSource.count()
			});
		}
		await this.emptyListInvoke();
		this.loading = false;
	}

	private async _loadGridLayoutData() {
		this.employeeLevels.push(...(await this.smartTableSource.getElements()));
	}

	private get _isGridLayout(): boolean {
		return this.componentLayoutStyleEnum.CARDS_GRID === this.dataLayoutStyle;
	}

	setView() {
		this.viewComponentName = ComponentEnum.EMPLOYEE_LEVELS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap(() => this._refresh$.next(true)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedEmployeeLevel = null;

				//when layout selector change then hide edit show card
				this.showAddCard = false;
				this.cancel();
			});
	}

	_loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			pager: {
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			actions: false,
			columns: {
				level: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.LEVEL'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				}
			}
		};
	}

	async addEmployeeLevel(level: string) {
		if (level) {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			await this.employeeLevelService.create({
				level,
				organizationId,
				tenantId,
				tags: this.tags
			});

			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_LEVELS.ADD_EMPLOYEE_LEVEL', {
				name: level
			});
			this._refresh$.next(true);
			this.subject$.next(true);
			this.cancel();
		} else {
			this.toastrService.danger(
				this.getTranslation('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_LEVELS.INVALID_EMPLOYEE_LEVEL'),
				this.getTranslation('TOASTR.MESSAGE.NEW_ORGANIZATION_EMPLOYEE_LEVEL_INVALID_NAME')
			);
		}
	}

	async editEmployeeLevel(id: string, employeeLevelName: string) {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const employeeLevel = {
			level: employeeLevelName,
			organizationId,
			tenantId,
			tags: this.tags
		};
		await this.employeeLevelService.update(id, employeeLevel);
		this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_LEVEL_UPDATE', {
			name: employeeLevelName
		});
		this._refresh$.next(true);
		this.subject$.next(true);
		this.cancel();
	}

	edit(employeeLevel: IEmployeeLevelInput) {
		this.showAddCard = true;
		this.isGridEdit = true;
		this.selected.employeeLevel = employeeLevel;
		this.selectedEmployeeLevel = employeeLevel;
		this.tags = employeeLevel.tags;
	}

	save(name: string) {
		if (this.isGridEdit) {
			this.editEmployeeLevel(this.selected.employeeLevel.id, name);
		} else {
			this.addEmployeeLevel(name);
		}
	}

	async removeEmployeeLevel(id: string, name: string) {
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Employee level'
				}
			}).onClose
		);
		if (result) {
			await this.employeeLevelService.delete(id);
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_LEVELS.REMOVE_EMPLOYEE_LEVEL', {
				name
			});
			this._refresh$.next(true);
			this.subject$.next(true);
			this.cancel();
		}
	}

	showEditCard(employeeLevel: IEmployeeLevelInput) {
		this.tags = employeeLevel.tags;
		this.showEditDiv = true;
		this.selected.employeeLevel = employeeLevel;
		this.selectedEmployeeLevel = employeeLevel;
	}

	cancel() {
		this.showEditDiv = false;
		this.showAddCard = false;
		this.selectedEmployeeLevel = null;
		this.selected = {
			employeeLevel: null,
			state: false
		};
		this.isGridEdit = false;
		this.tags = [];
		this.disabled = true;
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * if empty employment levels then displayed add button
	 */
	private async emptyListInvoke() {
		if (this.employeeLevels.length === 0) {
			this.cancel();
		}
	}

	openDialog(template: TemplateRef<any>, isEditTemplate: boolean) {
		try {
			isEditTemplate ? this.edit(this.selected.employeeLevel) : this.cancel();
			this.dialogService.open(template);
		} catch (error) {
			console.log('An error occurred on open dialog');
		}
	}

	selectEmployee(employeeLevel: any) {
		if (employeeLevel.data) employeeLevel = employeeLevel.data;
		const res =
			this.selected.employeeLevel && employeeLevel.id === this.selected.employeeLevel.id
				? { state: !this.selected.state }
				: { state: true };
		this.selected.state = res.state;
		this.disabled = !res.state;
		this.selected.employeeLevel = employeeLevel;
		this.selectedEmployeeLevel = employeeLevel;
	}
}
