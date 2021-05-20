import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
	ITag,
	IMerchant,
	IWarehouse,
	IImageAsset,
} from '@gauzy/contracts';
import { NbStepperComponent } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';
import { LatLng } from 'leaflet';
import { LocationFormComponent, LeafletMapComponent } from './../../../../../@shared/forms';
import {
	ToastrService,
	Store,
	WarehouseService,
	ImageAssetService,
	MerchantService
} from './../../../../../@core';
import { NbDialogService } from '@nebular/theme';
import { SelectAssetComponent } from './../../../../../@shared/select-asset-modal/select-asset.component';
import { TranslationBaseComponent } from './../../../../../@shared/language-base/translation-base.component';
import { Router, ActivatedRoute } from '@angular/router';



@UntilDestroy()
@Component({
	selector: 'ga-merchant-form',
	templateUrl: './merchant-form.component.html',
	styleUrls: ['./merchant-form.component.scss']
})
export class MerchantFormComponent
	extends TranslationBaseComponent
	implements OnInit {

	form: FormGroup;
	hoverState: boolean;
	tags: ITag[] = [];
	warehouses: IWarehouse[] = [];
	selectedWarehouses: string[] = [];
	image: IImageAsset = null;
	private newImageUploadedEvent$ = new Subject<any>();

	@ViewChild('stepper')
	stepper: NbStepperComponent;

	@ViewChild('locationFormDirective')
	locationFormDirective: LocationFormComponent;

	@ViewChild('leafletTemplate')
	leafletTemplate: LeafletMapComponent;

	images: IImageAsset[] = [];

	merchant: IMerchant;

	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	constructor(
		readonly translateService: TranslateService,
		private toastrService: ToastrService,
		private fb: FormBuilder,
		private store: Store,
		private warehouseService: WarehouseService,
		private dialogService: NbDialogService,
		private imageAssetService: ImageAssetService,
		private merchantService: MerchantService,
		private router: Router,
		private route: ActivatedRoute

	) {
		super(translateService);
	}


	ngOnInit(): void {

		this.route.params
		.pipe(untilDestroyed(this))
		.subscribe(async (params) => {
			if (params.id) {
				this.merchant = await this.merchantService.getById(
					params.id,
					['logo', 'warehouses', 'tags']
				);

				this.image = this.merchant.logo;
				this.tags = this.merchant.tags || [];
				this.selectedWarehouses = this.merchant.warehouses.map(
					warehouse => warehouse.id
				);
				this._initializeForm();
				this._initializeLocationForm();
			}
		});

		this._loadImages();
		this._initializeForm();
		this._loadWarehouses();
	}

	onWarehouseSelect($event) {
		this.selectedWarehouses = $event;
	}

	private async _loadImages() {
		const { items } = await this.imageAssetService.getAll({
			organizationId: this.store.selectedOrganization ? this.store.selectedOrganization.id : null
		});
		this.images = items;
	}

	private async _loadWarehouses() {
		const { items } = await this.warehouseService.getAll();
		this.warehouses = items;
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: [
				this.merchant ? this.merchant.name : '',
				Validators.required
			],
			logo: [this.merchant ? this.merchant.logo.url : ''],
			tags: this.tags,
			code: [
				this.merchant ? this.merchant.code : '',
				Validators.required
			],
			currency: [
				this.merchant ? this.merchant.currency : '',
				Validators.required
			],
			email: [
				this.merchant ? this.merchant.email : '',
				Validators.email
			],
			phone: [
				this.merchant ? this.merchant.phone : '',
				Validators.pattern('^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$')
			],
			fax: [
				this.merchant ? this.merchant.contact.fax : '',
			],
			fiscalInformation: [
				this.merchant ? this.merchant.contact.fiscalInformation : '',
			],
			website: [
				this.merchant ? this.merchant.contact.website : '',
			],
			active: [this.merchant ? this.merchant.active : true],
			description: [this.merchant ? this.merchant.description : '']
		})
	};

	private _initializeLocationForm() {
		if (!this.merchant || !this.merchant.contact) return;

		setTimeout(() => {
			const { contact } = this.merchant;
	
			this.locationFormDirective.setValue({
				country: contact.country,
				city: contact.city,
				postcode: contact.postcode,
				address: contact.address,
				address2: contact.address2,
				loc: {
					type: 'Point',
					coordinates: [contact.latitude, contact.longitude]
				}
			});
		}, 200);


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

	toMapStep() {
		setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
	}

	async onSaveRequest() {
		const locationFormValue = this.locationFormDirective.getValue();
		const { coordinates } = locationFormValue['loc'];

		delete locationFormValue['loc'];

		let request = {
			...this.form.value,
			warehouses: this.selectedWarehouses.map(id => { return { id } }),
			logo: this.image,
			organization: {
				id: this.store.selectedOrganization
					? this.store.selectedOrganization.id : null
			},
			tenant: {
				id: this.store.selectedOrganization && this.store.selectedOrganization.tenantId ?
					this.store.selectedOrganization.tenantId : null
			},
			contact: {
				...locationFormValue,
				fax: this.form.get('fax').value,
				email: this.form.get('email').value,
				fiscalInformation: this.form.get('fiscalInformation').value,
				website: this.form.get('website').value,
				phone: this.form.get('phone').value,
				latitude: coordinates[0],
				longitude: coordinates[1]
			}
		}

		if (!this.merchant) {
			await this.merchantService.create(request)
				.then(res => {
					this.toastrService.success(
						'INVENTORY_PAGE.MERCHANT_CREATED_SUCCESSFULLY',
						{ name: request.name }
					);

					this.merchant = res;
					this.router.navigate(['/pages/organization/inventory/merchants/all']);

				}).catch((err) => {
					this.toastrService.danger(
						'INVENTORY_PAGE.COULD_NOT_CREATE_MERCHANT',
						null,
						{ name: request.name }
					);
					this.router.navigate(['/pages/organization/inventory/merchants/all']);

				});
		} else {
			await this.merchantService.update({...request, id: this.merchant.id})
				.then(res => {
					this.toastrService.success(
						'INVENTORY_PAGE.MERCHANT_UPDATED_SUCCESSFULLY',
						{ name: request.name }
					);

					this.merchant = res;
					this.router.navigate(['/pages/organization/inventory/merchants/all']);

				}).catch((err) => {
					this.toastrService.danger(
						'INVENTORY_PAGE.COULD_NOT_UPDATE_MERCHANT',
						null,
						{ name: request.name }
					);
					this.router.navigate(['/pages/organization/inventory/merchants/all']);

				});
		}
	}

	selectedTagsEvent(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}

	onCoordinatesChanges($event) {
		const {
			loc: { coordinates }
		} = this.locationFormDirective.getValue();
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
}
