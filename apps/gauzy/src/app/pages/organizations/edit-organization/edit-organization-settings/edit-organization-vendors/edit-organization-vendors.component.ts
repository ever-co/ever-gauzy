import { Component, OnInit } from '@angular/core';
import { IOrganizationVendor, Tag } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { OrganizationVendorsService } from 'apps/gauzy/src/app/@core/services/organization-vendors.service';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';

@Component({
	selector: 'ga-edit-org-vendors',
	templateUrl: './edit-organization-vendors.component.html'
})
export class EditOrganizationVendorsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;
	showEditDiv: boolean;

	vendors: IOrganizationVendor[];

	selectedVendor: IOrganizationVendor;
	tags: Tag[] = [];

	constructor(
		private readonly organizationVendorsService: OrganizationVendorsService,
		private readonly toastrService: NbToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		readonly translateService: TranslateService,
		private errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadVendors();
				}
			});
	}

	showEditCard(vendor: IOrganizationVendor) {
		this.tags = vendor.tags;
		this.showEditDiv = true;
		this.selectedVendor = vendor;
	}

	cancel() {
		this.showEditDiv = !this.showEditDiv;
		this.selectedVendor = null;
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

	async editVendor(id: string, name: string) {
		await this.organizationVendorsService.update(id, {
			name: name,
			tags: this.tags
		});
		this.loadVendors();
		this.toastrService.success('Successfully updated');
		this.showEditDiv = !this.showEditDiv;
		this.tags = [];
	}

	private async addVendor(name: string) {
		if (name) {
			await this.organizationVendorsService.create({
				name,
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
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
