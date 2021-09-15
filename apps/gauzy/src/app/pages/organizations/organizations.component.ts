import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import {
	IOrganization,
	ComponentLayoutStyleEnum,
	IUser,
	CrudActionEnum
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { filter, first, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ErrorHandlingService, OrganizationsService, OrganizationEditStore, Store, ToastrService, UsersOrganizationsService } from '../../@core/services';
import { OrganizationsMutationComponent } from '../../@shared/organizations/organizations-mutation/organizations-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { OrganizationsCurrencyComponent, OrganizationsEmployeesComponent, OrganizationsStatusComponent } from './table-components';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { PictureNameTagsComponent } from '../../@shared/table-components';
import { ComponentEnum } from '../../@core/constants';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './organizations.component.html',
	styleUrls: ['./organizations.component.scss']
})
export class OrganizationsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	
	settingsSmartTable: object;
	selectedOrganization: IOrganization;
	smartTableSource = new LocalDataSource();
	organizations: IOrganization[] = [];
	viewComponentName: ComponentEnum;
	disableButton = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	loading = true;
	user: IUser;

	organizationsTable: Ng2SmartTableComponent;
	@ViewChild('organizationsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.organizationsTable = content;
			this.onChangedSource();
		}
	}
		
	constructor(
		private readonly organizationsService: OrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly router: Router,
		public readonly translateService: TranslateService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly store: Store,
		private readonly userOrganizationService: UsersOrganizationsService,
		private readonly _organizationEditStore: OrganizationEditStore
	) {
		super(translateService);
		this.setView();
	}

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
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => this.user = user),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this._loadSmartTable();
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
		this.viewComponentName = ComponentEnum.ORGANIZATION;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	selectOrganization({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedOrganization = isSelected ? data : null;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
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
				this.organizationsService
					.create(result)
					.then((organization: IOrganization) => {
						if (organization) {
							this._organizationEditStore.organizationAction = {
								organization,
								action: CrudActionEnum.CREATED
							};
							this.toastrService.success(
								'NOTES.ORGANIZATIONS.ADD_NEW_ORGANIZATION',
								{
									name: result.name
								}
							);
						}
					})
					.catch((error) => {
						this.errorHandler.handleError(error);
					})
					.finally(() => {
						this._loadSmartTable();
					});
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	async editOrganization(selectedItem?: IOrganization) {
		if (selectedItem) {
			this.selectOrganization({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([
			'/pages/organizations/edit/' + this.selectedOrganization.id
		]);
	}

	async deleteOrganization(selectedItem?: IOrganization) {
		if (selectedItem) {
			this.selectOrganization({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'ORGANIZATIONS_PAGE.ORGANIZATION'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				await this.organizationsService
					.delete(this.selectedOrganization.id)
					.then(() => {
						this._organizationEditStore.organizationAction = {
							organization: this.selectedOrganization,
							action: CrudActionEnum.DELETED
						};
						this.toastrService.success(
							'NOTES.ORGANIZATIONS.DELETE_ORGANIZATION',
							{
								name: this.selectedOrganization.name
							}
						);
					})
					.catch((error) => {
						this.errorHandler.handleError(error);
					})
					.finally(() => {
						this.clearItem();
						this._loadSmartTable();
					});
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private async _loadSmartTable() {
		try {
			const { items } = await this.userOrganizationService.getAll(
				['organization', 'organization.tags', 'organization.employees'],
				{ userId: this.store.userId, tenantId: this.user.tenantId }
			);

			this.organizations = items.map(
				(userOrganization) => userOrganization.organization
			);

			for (const org of this.organizations) {
				const activeEmployees = org.employees.filter((i) => i.isActive);
				org.totalEmployees = activeEmployees.length;
				delete org['employees'];
			}

			this.smartTableSource.load(this.organizations);
		} catch (error) {
			this.errorHandler.handleError(error);
		}

		this.loading = false;
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.organizationsTable.source.onChangedSource
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
		this.selectOrganization({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.organizationsTable && this.organizationsTable.grid) {
			this.organizationsTable.grid.dataSet['willSelect'] = 'false';
			this.organizationsTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
