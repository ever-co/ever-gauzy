import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Organization, PermissionsEnum } from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { EmployeesService } from '../../@core/services';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { Store } from '../../@core/services/store.service';
import { OrganizationsMutationComponent } from '../../@shared/organizations/organizations-mutation/organizations-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { OrganizationsCurrencyComponent } from './table-components/organizations-currency/organizations-currency.component';
import { OrganizationsEmployeesComponent } from './table-components/organizations-employees/organizations-employees.component';
import { OrganizationsStatusComponent } from './table-components/organizations-status/organizations-status.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';

interface SelectedRow {
	data: Organization;
	isSelected: boolean;
	selected: Organization[];
	source: LocalDataSource;
}

@Component({
	templateUrl: './organizations.component.html',
	styleUrls: ['./organizations.component.scss']
})
export class OrganizationsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		private organizationsService: OrganizationsService,
		private toastrService: NbToastrService,
		private dialogService: NbDialogService,
		private router: Router,
		private employeesService: EmployeesService,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService,
		private store: Store,
		private userOrganizationService: UsersOrganizationsService
	) {
		super(translateService);
	}

	private _ngDestroy$ = new Subject<void>();

	@ViewChild('settingsTable') settingsTable;

	settingsSmartTable: object;
	selectedOrganization: Organization;
	smartTableSource = new LocalDataSource();

	organizations: Organization[] = [];

	loading = true;
	hasEditPermission = false;
	hasEditExpensesPermission = false;
	loadSettingsSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('SM_TABLE.CLIENT_NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				totalEmployees: {
					title: this.getTranslation('SM_TABLE.EMPLOYEES'),
					type: 'custom',
					width: '200px',
					class: 'text-center',
					filter: false,
					renderComponent: OrganizationsEmployeesComponent
				},
				currency: {
					title: this.getTranslation('SM_TABLE.CURRENCY'),
					type: 'custom',
					class: 'text-center',
					width: '200px',
					renderComponent: OrganizationsCurrencyComponent
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					class: 'text-center',
					width: '200px',
					filter: false,
					renderComponent: OrganizationsStatusComponent
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	ngOnInit() {
		this._loadSmartTable();
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ALL_ORG_EDIT
				);
				this.hasEditExpensesPermission = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_EDIT
				);
			});
	}

	selectOrganization(data: SelectedRow) {
		if (data.isSelected) {
			this.selectedOrganization = data.data;
		} else {
			this.selectedOrganization = null;
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSettingsSmartTable();
		});
	}

	async addOrganization() {
		const result = await this.dialogService
			.open(OrganizationsMutationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				await this.organizationsService.create(result);
				this.toastrService.primary(
					this.getTranslation(
						'NOTES.ORGANIZATIONS.ADD_NEW_ORGANIZATION',
						{
							name: result.name
						}
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this._loadSmartTable();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	async editOrganization() {
		this.router.navigate([
			'/pages/organizations/edit/' + this.selectedOrganization.id
		]);
	}

	async deleteOrganization() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Organization'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				await this.organizationsService.delete(
					this.selectedOrganization.id
				);
				this.toastrService.primary(
					this.getTranslation(
						'NOTES.ORGANIZATIONS.DELETE_ORGANIZATION',
						{
							name: this.selectedOrganization.name
						}
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this._loadSmartTable();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private async _loadSmartTable() {
		try {
			const { items } = await this.userOrganizationService.getAll(
				['organization'],
				{
					userId: this.store.userId
				}
			);

			this.organizations = items.map(
				(userOrganization) => userOrganization.organization
			);

			for (const org of this.organizations) {
				const data = await this.employeesService
					.getAll([], { organization: { id: org.id } })
					.pipe(first())
					.toPromise();

				const activeEmployees = data.items.filter((i) => i.isActive);
				org.totalEmployees = activeEmployees.length;
			}

			this.smartTableSource.load(this.organizations);
			if (this.settingsTable) {
				this.settingsTable.grid.dataSet.willSelect = 'false';
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		}

		this.loading = false;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
