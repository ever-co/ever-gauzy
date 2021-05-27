import { ITag, IWarehouse, IImageAsset } from '@gauzy/contracts';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { LeafletMapComponent } from 'apps/gauzy/src/app/@shared/forms/maps/leaflet/leaflet.component';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { WarehouseService } from 'apps/gauzy/src/app/@core/services/warehouse.service';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { LatLng } from 'leaflet';
import { Location } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { LocationFormComponent } from 'apps/gauzy/src/app/@shared/forms/location';
import { NbDialogService } from '@nebular/theme';
import { SelectAssetComponent } from 'apps/gauzy/src/app/@shared/select-asset-modal/select-asset.component';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';
import { ImageAssetService } from 'apps/gauzy/src/app/@core';

@UntilDestroy()
@Component({
	selector: 'ga-warehouse-form',
	templateUrl: './warehouse-form.component.html',
	styleUrls: ['./warehouse-form.component.scss']
})
export class WarehouseFormComponent
	extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	tags: ITag[] = [];

	warehouse: IWarehouse;

	@ViewChild('locationFormDirective')
	locationFormDirective: LocationFormComponent;

	@ViewChild('leafletTemplate')
	leafletTemplate: LeafletMapComponent;

	hoverState: boolean;
	private newImageUploadedEvent$ = new Subject<any>();

	logo: IImageAsset = null;
	images: IImageAsset[] = [];

	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	constructor(
		private toastrService: ToastrService,
		private warehouseService: WarehouseService,
		readonly translateService: TranslateService,
		private route: ActivatedRoute,
		private fb: FormBuilder,
		private store: Store,
		private location: Location,
		private dialogService: NbDialogService,
		private imageAssetService: ImageAssetService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.params
			.pipe(untilDestroyed(this))
			.subscribe(async (params) => {
				if (params.id) {
					this.warehouse = await this.warehouseService.getById(
						params.id
					);

					this.tags = this.warehouse.tags || [];
					this.logo = this.warehouse.logo || null;

					this._initializeLocationForm();
					this._initializeForm();
				}
			});

		this._loadImages(); 
		this._initializeForm();
		this._initializeLocationForm();
	}

	async onImageSelect() {
		const dialog = this.dialogService.open(SelectAssetComponent, {
			context: {
				newImageUploadedEvent: this.newImageUploadedEvent$,
				galleryInput: this.images,
				settings: {
					uploadImageEnabled: true,
					deleteImageEnabled: true,
					selectMultiple: false
				}
			}
		});

		let selectedImage = await dialog.onClose.pipe(first()).toPromise();
		if(selectedImage) {
			this.logo = selectedImage;
		}
	}

	
	private async _loadImages() {
		const { items } = await this.imageAssetService.getAll({
			organizationId: this.store.selectedOrganization ? this.store.selectedOrganization.id : null
		});
		this.images = items;
	}



	private _initializeForm() {
		this.form = this.fb.group({
			name: [
				this.warehouse ? this.warehouse.name : '',
				Validators.required
			],
			tags: this.tags,
			code: [
				this.warehouse ? this.warehouse.code : '',
				Validators.required
			],
			email: [
				this.warehouse ? this.warehouse.email : '',
				Validators.email
			],
			active: [this.warehouse ? this.warehouse.active : false],
			logo: [this.warehouse ? this.warehouse.logo : ''],
			description: [this.warehouse ? this.warehouse.description : '']
		});
	}


	private _initializeLocationForm() {
		if (!this.warehouse || !this.warehouse.contact) return;

		const { contact } = this.warehouse;

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
	}

	handleImageUploadError(error) {
		this.toastrService.danger(
			'INVENTORY_PAGE.COULD_NOT_UPLOAD_IMAGE',
			'TOASTR.TITLE.ERROR'
		);
	}

	async onSaveRequest() {
		const locationFormValue = this.locationFormDirective.getValue();
		const { coordinates } = locationFormValue['loc'];
		delete locationFormValue['loc'];

		let request = {
			...this.form.value,
			logo: this.logo,
			contact: {
				...locationFormValue,
				latitude: coordinates[0],
				longitude: coordinates[1]
			}
		};

		if (!this.warehouse) {
			await this.warehouseService
				.create(request)
				.then((res) => {
					this.toastrService.success(
						'INVENTORY_PAGE.WAREHOUSE_WAS_CREATED',
						{ name: request.name }
					);

					this.warehouse = res;

				})
				.catch((err) => {
					this.toastrService.danger(
						'INVENTORY_PAGE.COULD_NOT_CREATE_WAREHOUSE',
						null,
						{ name: request.name }
					);
				});
		} else {
			await this.warehouseService
				.update(this.warehouse.id, request)
				.then((res) => {
					this.toastrService.success(
						'INVENTORY_PAGE.WAREHOUSE_WAS_UPDATED',
						{ name: request.name }
					);

					this.warehouse = res;

				});
		}
	}

	cancel() {
		this.location.back();
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

	onChangeTab(tab) {
		if (tab['tabTitle'] == 'Location') {
			setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
		}
	}

	isActiveInventoryTab() {
		return this.warehouse && this.warehouse.id;
	}
}
