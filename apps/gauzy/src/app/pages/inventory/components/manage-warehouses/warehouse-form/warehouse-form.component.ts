import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ITag, IWarehouse, IImageAsset, IOrganization } from '@gauzy/contracts';
import { Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LatLng } from 'leaflet';
import { NbDialogService, NbStepperComponent } from '@nebular/theme';
import { Subject, firstValueFrom, debounceTime } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { ToastrService } from '@gauzy/ui-sdk/core';
import { LocationFormComponent } from './../../../../../@shared/forms/location';
import { LeafletMapComponent } from './../../../../../@shared/forms/maps';
import { FormHelpers } from './../../../../../@shared/forms';
import { SelectAssetComponent } from './../../../../../@shared/select-asset-modal/select-asset.component';
import { ImageAssetService, WarehouseService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-warehouse-form',
	templateUrl: './warehouse-form.component.html',
	styleUrls: ['./warehouse-form.component.scss']
})
export class WarehouseFormComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	FormHelpers: typeof FormHelpers = FormHelpers;

	hoverState: boolean;
	organization: IOrganization;
	warehouse: IWarehouse;
	logo: IImageAsset;
	images: IImageAsset[] = [];

	private newImageUploadedEvent$ = new Subject<any>();

	/*
	 * Location Mutation Form
	 */
	readonly locationForm: UntypedFormGroup = LocationFormComponent.buildForm(this.fb);

	/*
	 * Warehouse Mutation Form
	 */
	public form: UntypedFormGroup = WarehouseFormComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: [null, Validators.required],
			tags: [],
			code: [null, Validators.required],
			email: [null, [Validators.required, Validators.email]],
			active: [false],
			logo: [null],
			description: [null]
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
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly imageAssetService: ImageAssetService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._getAssetsImages()),
				untilDestroyed(this)
			)
			.subscribe();
		this.newImageUploadedEvent$
			.pipe(
				filter((image) => !!image),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.route.data
			.pipe(
				debounceTime(100),
				filter((data) => !!data && !!data.warehouse),
				tap(({ warehouse }) => (this.warehouse = warehouse)),
				tap(() => {
					this._patchForm();
					this._patchLocationForm();
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

		let selectedImage = await firstValueFrom(dialog.onClose);
		if (selectedImage) {
			this.logo = selectedImage;
		}
	}

	private async _getAssetsImages() {
		if (!this.organization) {
			return;
		}
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
				coordinates: [contact.latitude, contact.longitude]
			}
		});
	}

	handleImageUploadError(error) {
		this.toastrService.danger('INVENTORY_PAGE.COULD_NOT_UPLOAD_IMAGE', 'TOASTR.TITLE.ERROR');
	}

	async onSaveRequest() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const locationFormValue = this.locationFormDirective.getValue();
		const { coordinates } = locationFormValue['loc'];
		delete locationFormValue['loc'];

		const [latitude, longitude] = coordinates;

		let request = {
			...this.form.value,
			logo: this.logo,
			tenantId,
			organizationId,
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
		this.router.navigate(['/pages/organization/inventory/warehouses']);
	}

	selectedTagsEvent(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
		this.form.updateValueAndValidity();
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

	stepClick() {
		setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
	}

	isActiveInventoryTab() {
		return this.warehouse && this.warehouse.id;
	}

	ngOnDestroy(): void {}
}
