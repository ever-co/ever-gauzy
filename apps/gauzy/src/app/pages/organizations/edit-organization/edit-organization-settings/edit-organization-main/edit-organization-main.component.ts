import { AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { ICurrency, IOrganization, ITag, CrudActionEnum, IImageAsset, CurrenciesEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DUMMY_PROFILE_IMAGE, Store, distinctUntilChange } from '@gauzy/ui-core/common';
import { ErrorHandlingService, OrganizationEditStore, OrganizationsService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-main',
	templateUrl: './edit-organization-main.component.html',
	styleUrls: ['./edit-organization-main.component.scss']
})
export class EditOrganizationMainComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {
	hoverState: boolean;
	employeesCount: number;

	@Input() organization: IOrganization;

	/*
	 * Organization Mutation Form
	 */
	public form: UntypedFormGroup = EditOrganizationMainComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			tags: [null],
			currency: [null, Validators.required],
			name: [null, Validators.required],
			officialName: [null],
			profile_link: [null, [Validators.required, Validators.pattern('^[a-z0-9-]+$')]],
			taxId: [null],
			registrationDate: [null],
			website: [null],
			imageUrl: [{ value: null, disabled: true }],
			imageId: []
		});
	}

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly fb: UntypedFormBuilder,
		private readonly organizationService: OrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly cdr: ChangeDetectorRef,
		private readonly errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.parent.data
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((data: Data) => !!data && !!data.organization),
				tap(({ employeesCount }) => (this.employeesCount = employeesCount)),
				map(({ organization }) => organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._setFormValues()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void { }

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	/**
	 * Upload organization image/avatar
	 *
	 * @param image
	 */
	async updateImageAsset(image: IImageAsset) {
		try {
			if (image && image.id) {
				this.form.get('imageId').setValue(image.id);
				this.form.get('imageUrl').setValue(image.fullUrl);
			} else {
				this.form.get('imageUrl').setValue(DUMMY_PROFILE_IMAGE);
			}
			await this.updateOrganizationSettings();
			this.form.updateValueAndValidity();
		} catch (error) {
			console.log('Error while updating organization avatars');
			this.errorHandler.handleError(error);
		}
	}

	handleImageUploadError(error: any) {
		// Delegate error handling to the _errorHandlingService
		this.errorHandler.handleError(error);
	}

	/**
	 * Update organization main settings
	 *
	 * @returns
	 */
	async updateOrganizationSettings() {
		if (!this.organization || this.form.invalid) {
			return;
		}
		try {
			const organization = await this.organizationService.update(this.organization.id, {
				defaultValueDateType: this.organization.defaultValueDateType,
				...this.form.value
			});
			if (organization) {
				this.organizationEditStore.organizationAction = {
					organization,
					action: CrudActionEnum.UPDATED
				};
				this.store.selectedOrganization = organization;
			}
			if (this.organization) {
				this.toastrService.success(`TOASTR.MESSAGE.MAIN_ORGANIZATION_UPDATED`, {
					name: this.organization.name
				});
			}
			this.router.navigate([`/pages/organizations`]);
		} catch (error) {
			console.log('Error while updating organization main details', error);
			this.errorHandler.handleError(error);
		}
	}

	/**
	 * Pre filled default form fields
	 *
	 * @returns
	 */
	private async _setFormValues() {
		if (!this.organization) {
			return;
		}
		this.form.setValue({
			imageId: this.organization.imageId || null,
			imageUrl: this.organization.imageUrl || null,
			tags: this.organization.tags || [],
			currency: this.organization.currency || null,
			name: this.organization.name || null,
			officialName: this.organization.officialName || null,
			profile_link: this.organization.profile_link || null,
			taxId: this.organization.taxId || null,
			website: this.organization.website || null,
			registrationDate: this.organization.registrationDate ? new Date(this.organization.registrationDate) : null
		});
		const { id: organizationId, tenantId } = this.organization;
		const values = {
			organizationId,
			tenantId,
			...(this.form.valid ? this.form.value : {})
		};
		await this.organizationEditStore.updateOrganizationForm(values);
		this.form.updateValueAndValidity();
	}

	/**
	 * On Changed Tags Event Emitter
	 *
	 * @param tags
	 */
	selectedTagsEvent(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) { }
}
