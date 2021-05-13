import { UntilDestroy } from '@ngneat/until-destroy';
import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	ITag,
	IProductStore,
	IWarehouse,
	IImageAsset,
} from '@gauzy/contracts';
import { NbStepperComponent } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@nebular/auth/node_modules/@angular/forms';
import { LocationFormComponent, LeafletMapComponent } from 'apps/gauzy/src/app/@shared/forms';
import {
	ToastrService,
	Store,
	WarehouseService,
	ImageAssetService,
	ProductStoreService
} from 'apps/gauzy/src/app/@core';
import { NbDialogService } from '@nebular/theme';
import { SelectAssetComponent } from 'apps/gauzy/src/app/@shared/select-asset-modal/select-asset.component';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';
import { LatLng } from 'leaflet';



@UntilDestroy()
@Component({
	selector: 'ga-product-store-form',
	templateUrl: './product-store-form.component.html',
	styleUrls: ['./product-store-form.component.scss']
})
export class ProductStoreFormComponent
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

	productStore: IProductStore;

	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	constructor(
		readonly translateService: TranslateService,
		private toastrService: ToastrService,
		private fb: FormBuilder,
		private store: Store,
		private warehouseService: WarehouseService,
		private dialogService: NbDialogService,
		private imageAssetService: ImageAssetService,
		private productStoreService: ProductStoreService

	) {
		super(translateService);
	}


	ngOnInit(): void {
		this._loadImages();
		this._initializeForm();
		this._loadWarehouses();

	}

	onWarehouseSelect($event) {

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
				this.productStore ? this.productStore.name : '',
				Validators.required
			],
			logo: [this.productStore ? this.productStore.logo.url : ''],
			tags: this.tags,
			code: [
				this.productStore ? this.productStore.code : '',
				Validators.required
			],
			currency: [
				this.productStore ? this.productStore.code : '',
				Validators.required
			],
			email: [
				this.productStore ? this.productStore.email : '',
				Validators.email
			],
			phone: [
				this.productStore ? this.productStore.contact.phone : '',
				Validators.pattern('^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$')
			],
			fax: [
				this.productStore ? this.productStore.contact.fax : '',
			],
			fiscalInformation: [
				this.productStore ? this.productStore.contact.fax : '',
			],
			website: [
				this.productStore ? this.productStore.contact.fax : '',
			],
			active: [this.productStore ? this.productStore.active : true],
			description: [this.productStore ? this.productStore.description : '']
		})
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

	onChangeTab(tab) {
		if (tab['tabTitle'] == 'Location') {
			setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
		}
	}

	cancel() {

	}

	async onSaveRequest() {

		const locationFormValue = this.locationFormDirective.getValue();
		const { coordinates } = locationFormValue['loc'];

		delete locationFormValue['loc'];

		let request = {
			...this.form.value,
			warehouses: this.selectedWarehouses,
			logo: this.image,
			contact: {
				...locationFormValue,
				latitude: coordinates[0],
				longitude: coordinates[1]
			}
		}

		if (!this.productStore) {
			const res = await this.productStoreService.create(request);
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


	onMapClicked($event) {

	}


}
