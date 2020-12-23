import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	IOrganizationVendor,
	ITag,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/models';
import { NbDialogService } from '@nebular/theme';
import { OrganizationVendorsService } from 'apps/gauzy/src/app/@core/services/organization-vendors.service';
import { TranslateService } from '@ngx-translate/core';
import { first, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { Store } from '../../@core/services/store.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { LocalDataSource } from 'ng2-smart-table';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ToastrService } from '../../@core/services/toastr.service';

@Component({
	selector: 'ga-vendors',
	templateUrl: './vendors.component.html',
	styleUrls: ['vendors.component.scss']
})
export class VendorsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	selectedOrganization: IOrganization;
	showAddCard: boolean;
	vendors: IOrganizationVendor[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedVendor: IOrganizationVendor;
	tags: ITag[] = [];
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	currentVendor: IOrganizationVendor;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private readonly organizationVendorsService: OrganizationVendorsService,
		private readonly toastrService: ToastrService,
		private readonly fb: FormBuilder,
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private errorHandlingService: ErrorHandlingService,
		private store: Store,
		private router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._initializeForm();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganization = organization;
					this.cancel();
					this.loadVendors();
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

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: ['', Validators.required],
			phone: [''],
			email: ['', Validators.email],
			website: [''],
			tags: ['']
		});
	}

	setView() {
		this.viewComponentName = ComponentEnum.VENDORS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
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
		this.form.reset();
		this.showAddCard = true;
		this.tags = [];
	}

	edit(vendor: IOrganizationVendor) {
		this.showAddCard = true;
		this.form.patchValue(vendor);
		this.tags = vendor.tags;
		this.currentVendor = vendor;
	}

	cancel() {
		this.form.reset();
		this.showAddCard = false;
		this.currentVendor = null;
	}

	save() {
		if (this.currentVendor) {
			this.updateVendor(this.currentVendor);
			this.currentVendor = null;
		} else {
			this.createVendor();
		}
	}

	async createVendor() {
		if (!this.form.invalid) {
			const name = this.form.get('name').value;
			const { id: organizationId, tenantId } = this.selectedOrganization;

			await this.organizationVendorsService.create({
				name: this.form.get('name').value,
				phone: this.form.get('phone').value,
				email: this.form.get('email').value,
				website: this.form.get('website').value,
				organizationId,
				tenantId,
				tags: this.tags
			});

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.ADD_VENDOR',
				{
					name: name
				}
			);
			this.showAddCard = !this.showAddCard;
			this.loadVendors();
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
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Vendor'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				await this.organizationVendorsService.delete(id);
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.REMOVE_VENDOR',
					{
						name
					}
				);
				this.loadVendors();
			} catch (error) {
				this.errorHandlingService.handleError(error);
			}
		}
	}

	async updateVendor(vendor: IOrganizationVendor) {
		const name = this.form.get('name').value;
		const { id: organizationId, tenantId } = this.selectedOrganization;

		await this.organizationVendorsService.update(vendor.id, {
			name: this.form.get('name').value,
			phone: this.form.get('phone').value,
			email: this.form.get('email').value,
			website: this.form.get('website').value,
			tags: this.tags,
			organizationId,
			tenantId
		});

		this.toastrService.success(
			'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.UPDATE_VENDOR',
			{ name }
		);

		this.loadVendors();
		this.showAddCard = !this.showAddCard;
		this.tags = [];
	}

	private async loadVendors() {
		if (!this.selectedOrganization) {
			return;
		}

		const { id: organizationId, tenantId } = this.selectedOrganization;
		const res = await this.organizationVendorsService.getAll(
			{
				organizationId,
				tenantId
			},
			['tags']
		);
		if (res) {
			this.vendors = res.items;
			this.smartTableSource.load(res.items);
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}
}
