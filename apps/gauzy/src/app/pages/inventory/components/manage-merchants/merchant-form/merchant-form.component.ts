import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbStepperComponent } from '@nebular/theme';
import { Subject } from 'rxjs';
import { filter, first, tap } from 'rxjs/operators';
import { LatLng } from 'leaflet';
import {
	ITag,
	IMerchant,
	IWarehouse,
	IImageAsset,
	IOrganization,
} from '@gauzy/contracts';
import { LocationFormComponent, LeafletMapComponent } from './../../../../../@shared/forms';
import {
	ToastrService,
	Store,
	WarehouseService,
	ImageAssetService,
	MerchantService
} from './../../../../../@core/services';
import { SelectAssetComponent } from './../../../../../@shared/select-asset-modal/select-asset.component';
import { TranslationBaseComponent } from './../../../../../@shared/language-base/translation-base.component';



@UntilDestroy()
@Component({
	selector: 'ga-merchant-form',
	templateUrl: './merchant-form.component.html',
	styleUrls: ['./merchant-form.component.scss']
})
export class MerchantFormComponent
	extends TranslationBaseComponent
	implements OnInit {

	merchantId: string;
	organization: IOrganization;
	hoverState: boolean;
	warehouses: IWarehouse[] = [];
	selectedWarehouses: string[] = [];
	image: IImageAsset = null;
	images: IImageAsset[] = [];
	merchant: IMerchant;
	
	private newImageUploadedEvent$ = new Subject<any>();
	
	/**
	 * Location Mutation Form
	 */
	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	/**
	 * Merchant Mutation Form
	 */
	public form: FormGroup = MerchantFormComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			logo: [],
			tags: [],
			name: ['', Validators.required ],
			code: ['', Validators.required ],
			currency: ['', Validators.required ],
			email: ['', Validators.email ],
			phone: ['', Validators.pattern('^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$') ],
			fax: [],
			fiscalInformation: [],
			website: [],
			active: [false],
			description: []
		});
	}

	/**
	 * Location Form Directive
	 */
	@ViewChild('locationFormDirective')
	locationFormDirective: LocationFormComponent;

	/**
	 * Leaflet Map Directive
	 */
	@ViewChild('leafletTemplate')
	leafletTemplate: LeafletMapComponent;

	/**
	 * Form Stepper Directive
	 */
	@ViewChild('stepper')
	stepper: NbStepperComponent;

	constructor(
		public readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly warehouseService: WarehouseService,
		private readonly dialogService: NbDialogService,
		private readonly imageAssetService: ImageAssetService,
		private readonly merchantService: MerchantService,
		private readonly router: Router,
		private readonly route: ActivatedRoute

	) {
		super(translateService);
	}


	ngOnInit(): void {
		this.route.params
			.pipe(
				filter((params) => !!params.id),
				tap(({ id }) => this.merchantId = id),
				untilDestroyed(this)
			)
			.subscribe(async (params) => {
				if (params.id) {
					this.merchant = await this.merchantService.getById(
						params.id,
						['logo', 'contact', 'warehouses', 'tags']
					);					
					this._patchForm();
					this._patchLocationForm();
				}
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._getWarehouses()),
				tap(() => this._getAssetsImages()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onWarehouseSelect($event) {
		this.selectedWarehouses = $event;
	}

	private async _getAssetsImages() {
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.images = (
			await this.imageAssetService.getAll({ tenantId, organizationId })
		).items;
	}

	private async _getWarehouses() {
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.warehouses = (
			await this.warehouseService.getAll({ findInput: { organizationId, tenantId } })
		).items;
	}

	private _patchForm() {
		if (!this.merchant) return;

		const { merchant } = this;
		this.form.patchValue({
			name: merchant.name,
			tags: merchant.tags,
			code: merchant.code,
			email: merchant.email,
			active: merchant.active,
			description: merchant.description,
			logo: merchant.logo,
			currency: merchant.currency,
			phone: merchant.phone
		});

		this.image = merchant.logo;
		this.selectedWarehouses = merchant.warehouses.map((warehouse) => warehouse.id);
	};

	private _patchLocationForm() {
		if (!this.merchant || !this.merchant.contact) return;

		const { contact } = this.merchant;
		this.locationFormDirective.setValue({
			country: contact.country,
			city: contact.city,
			postcode: contact.postcode,
			address: contact.address,
			address2: contact.address2,
			loc: {
				type: 'Point',
				coordinates: [
					contact.latitude,
					contact.longitude
				]
			}
		});

		this.form.patchValue({
			fax: contact.fax,
			fiscalInformation: contact.fiscalInformation,
			website: contact.website
		});
	}

	async onImageSelect() {
		const dialog = this.dialogService.open(SelectAssetComponent, {
			context: {
				newImageUploadedEvent: this.newImageUploadedEvent$,
				galleryInput: this.images,
				settings: {
					uploadImageEnabled: false,
					deleteImageEnabled: false,
					selectMultiple: false
				}
			}
		});

		let selectedImage = await dialog.onClose.pipe(first()).toPromise();
		if (selectedImage) {
			this.image = selectedImage;
		}
	}

	stepClick() {
		setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
	}

	async onSaveRequest() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const locationFormValue = this.locationFormDirective.getValue();
		const { coordinates } = locationFormValue['loc'];
		delete locationFormValue['loc'];

		const [ latitude, longitude ] = coordinates;

		const request = {
			...this.form.getRawValue(),
			warehouses: this.selectedWarehouses.map(id => { return { id } }),
			logo: this.image,
			tenantId,
			organizationId,
			contact: {
				...locationFormValue,
				...this.form.getRawValue(),
				latitude,
				longitude
			}
		}

		if (!this.merchant) {
			await this.merchantService.create(request)
				.then(() => {
					this.toastrService.success('INVENTORY_PAGE.MERCHANT_CREATED_SUCCESSFULLY', {
						name: request.name
					});
				})
				.catch(() => {
					this.toastrService.danger('INVENTORY_PAGE.COULD_NOT_CREATE_MERCHANT', null, {
						name: request.name
					});
				})
				.finally(() => {
					this.cancel();
				});
		} else {
			await this.merchantService.update({...request, id: this.merchant.id})
				.then(() => {
					this.toastrService.success('INVENTORY_PAGE.MERCHANT_UPDATED_SUCCESSFULLY', {
						name: request.name
					});
				})
				.catch(() => {
					this.toastrService.danger( 'INVENTORY_PAGE.COULD_NOT_UPDATE_MERCHANT', null, {
						name: request.name
					});
				})
				.finally(() => {
					this.cancel();
				});
		}
	}

	cancel() {
		this.router.navigate([
			'/pages/organization/inventory/merchants'
		]);
	}

	selectedTagsEvent(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.updateValueAndValidity();
	}

	onCoordinatesChanges($event) {
		const { loc: { coordinates } } = this.locationFormDirective.getValue();
		const [lat, lng] = coordinates;
		this.leafletTemplate.addMarker(new LatLng(lat, lng));
	}

	onMapClicked(latlng: LatLng) {
		const { lat, lng } = latlng;
		const location = this.locationFormDirective.getValue();

		this.locationFormDirective.setValue({
			...location,
			country: '',
			loc: {
				type: 'Point',
				coordinates: [lat, lng]
			}
		});
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}
}
