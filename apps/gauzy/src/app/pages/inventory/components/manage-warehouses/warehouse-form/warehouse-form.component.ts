import { ITag, IWarehouse, IImageAsset, IOrganization } from '@gauzy/contracts';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LatLng } from 'leaflet';
import { Component, OnInit, ViewChild } from '@angular/core';
import { NbDialogService, NbStepperComponent } from '@nebular/theme';
import { Subject } from 'rxjs';
import { filter, first, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { LocationFormComponent } from './../../../../../@shared/forms/location';
import { LeafletMapComponent } from './../../../../../@shared/forms/maps';
import { SelectAssetComponent } from './../../../../../@shared/select-asset-modal/select-asset.component';
import { ImageAssetService, Store, ToastrService, WarehouseService } from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-warehouse-form',
	templateUrl: './warehouse-form.component.html',
	styleUrls: ['./warehouse-form.component.scss']
})
export class WarehouseFormComponent
	extends TranslationBaseComponent
	implements OnInit {
	
	warehouseId: string;
	hoverState: boolean;
	organization: IOrganization;
	warehouse: IWarehouse;
	logo: IImageAsset;
	images: IImageAsset[] = [];
	
	private newImageUploadedEvent$ = new Subject<any>();
	
	/*
	* Location Mutation Form 
	*/
	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	/*
	* Warehouse Mutation Form 
	*/
	public form: FormGroup = WarehouseFormComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			name: ['', Validators.required],
			tags: [],
			code: ['', Validators.required],
			email: ['', Validators.email],
			active: [false],
			logo: [''],
			description: ['']
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
		private readonly toastrService: ToastrService,
		private readonly warehouseService: WarehouseService,
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly imageAssetService: ImageAssetService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.params
			.pipe(
				filter((params) => !!params.id),
				tap(({ id }) => this.warehouseId = id),
				untilDestroyed(this)
			)
			.subscribe(async (params) => {
				if (params.id) {
					this.warehouse = await this.warehouseService.getById(
						params.id,
						['logo', 'contact', 'tags']
					);
					this._patchForm();
					this._patchLocationForm();
				}
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._getAssetsImages()),
				untilDestroyed(this)
			)
			.subscribe();
		this.newImageUploadedEvent$
			.pipe(
				filter((image) => !!image),
				tap((image) => {
					console.log(image)
				}),
				untilDestroyed(this)
			)
			.subscribe();
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

	
	private async _getAssetsImages() {
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		this.images = (await this.imageAssetService.getAll({ tenantId, organizationId })).items;
	}

	private _patchForm() {
		if (!this.warehouse) return;

		const { warehouse } = this;

		this.form.patchValue({
			name: warehouse.name,
			tags: warehouse.tags,
			code: warehouse.code,
			email: warehouse.email,
			active: warehouse.active,
			description: warehouse.description,
			logo: warehouse.logo
		});

		this.logo = warehouse.logo || null;
	}

	private _patchLocationForm() {
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
				coordinates: [
					contact.latitude,
					contact.longitude
				]
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

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization || { id: null };

		const locationFormValue = this.locationFormDirective.getValue();
		const { coordinates } = locationFormValue['loc'];
		delete locationFormValue['loc'];

		const [ latitude, longitude ] = coordinates;

		let request = {
			...this.form.value,
			logo: this.logo,
			tenant: { id: tenantId},
			organization: { id: organizationId},
			contact: {
				...locationFormValue,
				latitude,
				longitude
			}
		};

		if (!this.warehouse) {
			await this.warehouseService
				.create(request)
				.then(() => {
					this.toastrService.success('INVENTORY_PAGE.WAREHOUSE_WAS_CREATED', { 
						name: request.name 
					});
				})
				.catch(() => {
					this.toastrService.danger('INVENTORY_PAGE.COULD_NOT_CREATE_WAREHOUSE', null, { 
						name: request.name
					});
				})
				.finally(() => {
					this.cancel();
				});
		} else {
			await this.warehouseService
				.update(this.warehouse.id, request)
				.then((res) => {
					this.toastrService.success('INVENTORY_PAGE.WAREHOUSE_WAS_UPDATED', { 
						name: request.name 
					});
					this.warehouse = res;
				})
				.finally(() => {
					this.cancel();
				});
		}
	}

	cancel() {
		this.router.navigate([
			'/pages/organization/inventory/warehouses'
		]);
	}

	selectedTagsEvent(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
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

	stepClick() {
		setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
	}

	isActiveInventoryTab() {
		return this.warehouse && this.warehouse.id;
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}
}
