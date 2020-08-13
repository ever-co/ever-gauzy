import { Component, OnInit } from '@angular/core';
import {
	IOrganizationVendor,
	Tag,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationVendorsService } from 'apps/gauzy/src/app/@core/services/organization-vendors.service';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { Store } from '../../@core/services/store.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { LocalDataSource } from 'ng2-smart-table';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

@Component({
	selector: 'ga-vendors',
	templateUrl: './vendors.component.html',
	styleUrls: ['vendors.component.scss']
})
export class VendorsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();
	organizationId: string;
	showAddCard: boolean;
	vendors: IOrganizationVendor[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedVendor: IOrganizationVendor;
	tags: Tag[] = [];
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	currentVendor: IOrganizationVendor;
	constructor(
		private readonly organizationVendorsService: OrganizationVendorsService,
		private readonly toastrService: NbToastrService,
		private readonly fb: FormBuilder,
		readonly translateService: TranslateService,
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
					this.organizationId = organization.id;
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
		this.showAddCard = !this.showAddCard;
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
			await this.organizationVendorsService.create({
				name: this.form.get('name').value,
				phone: this.form.get('phone').value,
				email: this.form.get('email').value,
				website: this.form.get('website').value,
				organizationId: this.organizationId,
				tags: this.tags
			});
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.ADD_VENDOR',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddCard = !this.showAddCard;
			this.loadVendors();
		} else {
			// TODO translate
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.INVALID_VENDOR_NAME'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_VENDOR_INVALID_NAME'
				)
			);
		}
	}
	async removeVendor(id: string, name: string) {
		try {
			await this.organizationVendorsService.delete(id);

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.REMOVE_VENDOR',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.loadVendors();
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
	}

	async updateVendor(vendor: IOrganizationVendor) {
		await this.organizationVendorsService.update(vendor.id, {
			name: this.form.get('name').value,
			phone: this.form.get('phone').value,
			email: this.form.get('email').value,
			website: this.form.get('website').value,
			tags: this.tags
		});
		this.loadVendors();
		this.toastrService.success('Successfully updated');
		this.showAddCard = !this.showAddCard;
		this.tags = [];
	}
	private async loadVendors() {
		if (!this.organizationId) {
			return;
		}
		const res = await this.organizationVendorsService.getAll(
			{
				organizationId: this.organizationId
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
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}
