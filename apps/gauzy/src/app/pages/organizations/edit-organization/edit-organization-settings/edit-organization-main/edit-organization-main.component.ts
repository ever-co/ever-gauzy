import { AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { ICurrency, IOrganization, ITag, CrudActionEnum, IImageAsset } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DUMMY_PROFILE_IMAGE, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	OrganizationEditStore,
	OrganizationsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-edit-org-main',
    templateUrl: './edit-organization-main.component.html',
    styleUrls: ['./edit-organization-main.component.scss'],
    standalone: false
})
export class EditOrganizationMainComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit
{
	hoverState: boolean;
	avatarFailed = false;

	@Input() organization: IOrganization;

	/**
	 * Headcount shown beside the logo.
	 *
	 * This used to be assigned from `route.parent.data`, but the parent route resolves
	 * only `organization` and `organizationTaskSetting` — there has never been an
	 * `employeesCount` key to destructure, so the panel rendered a bare "Employees"
	 * with no number in front of it. The count lives on the organization itself, kept
	 * up to date by the employee subscriber.
	 */
	get employeesCount(): number {
		return this.organization?.totalEmployees ?? 0;
	}

	get hasBonusFacts(): boolean {
		return !!this.organization?.bonusType || this.organization?.bonusPercentage != null;
	}

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
				map(({ organization }) => organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._setFormValues()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

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
				this.avatarFailed = false;
				this.form.get('imageId').setValue(image.id);
				this.form.get('imageUrl').setValue(image.fullUrl);
			} else {
				this.form.get('imageUrl').setValue(DUMMY_PROFILE_IMAGE);
			}
			// Persist, but stay put. This used to call `updateOrganizationSettings()`,
			// which ends by navigating to the organizations list — so picking a logo
			// saved the form and then threw you off the page you were editing.
			await this.saveOrganization();
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
	 * Update organization main settings, then return to the organizations list.
	 *
	 * @returns
	 */
	async updateOrganizationSettings() {
		if (await this.saveOrganization()) {
			this.router.navigate([`/pages/organizations`]);
		}
	}

	/**
	 * Persist the form without leaving the page.
	 *
	 * @returns whether the organization was saved
	 */
	private async saveOrganization(): Promise<boolean> {
		if (!this.organization || this.form.invalid) {
			return false;
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
			return true;
		} catch (error) {
			console.log('Error while updating organization main details', error);
			this.errorHandler.handleError(error);
			return false;
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
		// A new organization gets a fresh chance at loading its logo; without this the
		// placeholder would stick for the rest of the session after one broken image.
		this.avatarFailed = false;
		this.form.setValue({
			imageId: this.organization.imageId || null,
			// Same expression the card header resolves the logo with. Reading only the
			// `imageUrl` column showed the placeholder here while the header, a few
			// pixels above, showed the uploaded asset. `imageUrl` is a disabled control,
			// so this is display-only and never reaches the update payload.
			imageUrl: this.organization.image?.fullUrl || this.organization.imageUrl || null,
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
	currencyChanged($event: ICurrency) {}
}
