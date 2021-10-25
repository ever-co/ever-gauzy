import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	IOrganizationVendor,
	ITag,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { LocalDataSource } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from './../../@shared/language-base/translation-base.component';
import { ComponentEnum } from './../../@core/constants';
import { NotesWithTagsComponent } from './../../@shared/table-components';
import { DeleteConfirmationComponent } from './../../@shared/user/forms';
import { ErrorHandlingService, OrganizationVendorsService, Store, ToastrService } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-vendors',
	templateUrl: './vendors.component.html',
	styleUrls: ['vendors.component.scss']
})
export class VendorsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	organization: IOrganization;
	showAddCard: boolean;
	vendors: IOrganizationVendor[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedVendor: IOrganizationVendor;
	tags: ITag[] = [];
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	form: FormGroup;

	constructor(
		private readonly organizationVendorsService: OrganizationVendorsService,
		private readonly toastrService: ToastrService,
		private readonly fb: FormBuilder,
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly store: Store,
		private readonly router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._initializeForm();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization) => this.organization = organization),
				tap(() => this.loadVendors()),
				untilDestroyed(this)
			)
			.subscribe();
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	ngOnDestroy(): void { }

	private _initializeForm() {
		this.form = this.fb.group({
			name: ['', Validators.required],
			phone: [''],
			email: ['', [Validators.required, Validators.email]],
			website: [''],
			tags: ['']
		});
	}

	setView() {
		this.viewComponentName = ComponentEnum.VENDORS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;

				this.selectedVendor = null;

				//when layout selector change then hide edit showcard
				this.showAddCard = false;
			});
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				tags: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				},
				phone: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.PHONE'),
					type: 'string'
				},
				email: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EMAIL'),
					type: 'string'
				},
				website: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.WEBSITE'),
					type: 'string'
				}
			}
		};
	}

	add() {
		this.showAddCard = true;
	}

	edit(vendor: IOrganizationVendor) {
		this.showAddCard = true;
		this.tags = vendor.tags;
		this.selectedVendor = vendor;
		this.form.patchValue(vendor);
	}

	cancel() {
		this.form.reset();
		this.selectedVendor = null;
		this.tags = [];
		this.showAddCard = false;
	}

	save() {
		if (this.selectedVendor) {
			this.updateVendor(this.selectedVendor);
		} else {
			this.createVendor();
		}
	}

	async createVendor() {
		if (!this.form.invalid) {
			const { name, phone, email, website } = this.form.value;
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			this.organizationVendorsService
				.create({
					name,
					phone,
					email,
					website,
					organizationId,
					tenantId,
					tags: this.tags
				})
				.then(() => {
					this.toastrService.success(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.ADD_VENDOR',
						{ name }
					);
				}).finally(() => {
					this.loadVendors();
					this.cancel();
				});
		} else {
			// TODO translate
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.INVALID_VENDOR_NAME',
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_VENDOR_INVALID_NAME'
				)
			);
		}
	}

	async removeVendor(id: string, name: string) {
		const result = await firstValueFrom(this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('ORGANIZATIONS_PAGE.VENDOR')
				}
			})
			.onClose);

		if (result) {
			try {
				await this.organizationVendorsService.delete(id);
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.REMOVE_VENDOR',
					{ name }
				);
				this.loadVendors();
			} catch (error) {
				this.errorHandlingService.handleError(error);
			}
		}
	}

	async updateVendor(vendor: IOrganizationVendor) {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { name, phone, email, website } = this.form.value;

		this.organizationVendorsService
			.update(vendor.id, {
				name,
				phone,
				email,
				website,
				tags: this.tags,
				organizationId,
				tenantId
			})
			.then(() => {
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.UPDATE_VENDOR',
					{ name }
				);
			})
			.finally(() => {
				this.loadVendors();
				this.cancel();
			});
	}

	private loadVendors() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.organizationVendorsService
			.getAll(
				{ organizationId, tenantId },
				['tags'],
				{ createdAt: 'DESC' }
			)
			.then(({ items }) => {
				this.vendors = items;
				this.smartTableSource.load(this.vendors);
			});
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}
}
