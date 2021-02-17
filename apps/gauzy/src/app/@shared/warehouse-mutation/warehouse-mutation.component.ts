import { Component, OnInit, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { ITag } from '@gauzy/contracts';
import { LocationFormComponent } from '../forms/location';
import { LeafletMapComponent } from '../forms/maps/leaflet/leaflet.component';
import { IWarehouse } from 'packages/contracts/dist';
import { WarehouseService } from '../../@core/services/warehouse.service';
import { ToastrService } from '../../@core/services/toastr.service';

@Component({
	selector: 'ga-warehouse-mutation',
	templateUrl: './warehouse-mutation.component.html',
	styleUrls: ['./warehouse-mutation.component.scss']
})
export class WarehouseMutationComponent
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
		public dialogRef: NbDialogRef<WarehouseMutationComponent>,
		private toastrService: ToastrService,
		private warehouseService: WarehouseService,
		readonly translateService: TranslateService,
		private fb: FormBuilder
	) {
		super(translateService);
	}

	ngOnInit(): void {
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

					this.dialogRef.close(res);
				})
				.catch((err) => {
					this.toastrService.danger(
						'INVENTORY_PAGE.COULD_NOT_CREATE_WAREHOUSE'
					);
				});
		} else {
		}
	}

	selectedTagsEvent(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}
}
