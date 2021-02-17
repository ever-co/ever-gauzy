import {
	Component,
	OnChanges,
	OnInit,
	SimpleChanges,
	ViewChild
} from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { ComponentLayoutStyleEnum, ITag, IWarehouse } from '@gauzy/contracts';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { LocationFormComponent } from 'apps/gauzy/src/app/@shared/forms/location';
import { LeafletMapComponent } from 'apps/gauzy/src/app/@shared/forms/maps/leaflet/leaflet.component';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { WarehouseService } from 'apps/gauzy/src/app/@core/services/warehouse.service';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentEnum } from 'apps/gauzy/src/app/@core/constants/layout.constants';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

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

	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	constructor(
		private toastrService: ToastrService,
		private warehouseService: WarehouseService,
		readonly translateService: TranslateService,
		private route: ActivatedRoute,
		private fb: FormBuilder,
		private store: Store
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
				}
			});

		this._initializeForm();
		this._initializeLocationForm();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: [
				this.warehouse ? this.warehouse.name : '',
				Validators.required
			],
			tags:
				this.warehouse && this.warehouse.tags
					? [this.warehouse.tags]
					: [],
			code: [
				this.warehouse ? this.warehouse.code : '',
				Validators.required
			],
			email: [
				this.warehouse ? this.warehouse.email : '',
				Validators.required
			],
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
			location: {
				...locationFormValue,
				latitude: coordinates[0],
				longitude: coordinates[1]
			}
		};

		let result;

		if (!this.warehouse) {
			result = await this.warehouseService
				.create(request)
				.then((res) => {
					//tstodo
					this.toastrService.success(
						'INVENTORY_PAGE.WAREHOUSE_CREATED'
					);
				})
				.catch((err) => {
					this.toastrService.danger(
						'INVENTORY_PAGE.COULD_NOT_CREATE_WAREHOUSE'
					);
				});
		} else {
		}
	}

	cancel() {}

	selectedTagsEvent(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}

	onCoordinatesChanges(coord) {}

	onGeometrySend(coord) {
		//tstodo
		console.log(coord, 'on geometry send');
	}

	onMapClicked($event) {}
}
