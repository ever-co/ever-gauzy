import { OnInit, Component } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { IEquipment, ITag, IOrganization, IImageAsset } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { EquipmentService } from '../../@core/services/equipment.service';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { environment as ENV } from 'apps/gauzy/src/environments/environment';
import { NbDialogService } from '@nebular/theme';
import { SelectAssetComponent } from 'apps/gauzy/src/app/@shared/select-asset-modal/select-asset.component';
import { Subject, firstValueFrom } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ImageAssetService, ToastrService } from '../../@core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-equipment-mutation',
	templateUrl: './equipment-mutation.component.html',
	styleUrls: ['./equipment-mutation.component.scss']
})
export class EquipmentMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	equipment: IEquipment;
	image: IImageAsset;
	selectedCurrency: string;
	tags: ITag[] = [];
	selectedTags: any;
	selectedOrganization: IOrganization;
	organization: IOrganization;
	hoverState = false;

	private newImageUploadedEvent$ = new Subject<any>();
	private newImageStoredEvent$ = new Subject<any>();

	constructor(
		public dialogRef: NbDialogRef<EquipmentMutationComponent>,
		private dialogService: NbDialogService,
		private equipmentService: EquipmentService,
		private fb: FormBuilder,
		readonly translationService: TranslateService,
		readonly store: Store,
		private imageAssetService: ImageAssetService,
		private toastrService: ToastrService
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.selectedCurrency = this.store.selectedOrganization
			? this.store.selectedOrganization.currency
			: ENV.DEFAULT_CURRENCY;

		this.initializeForm();

		this.image = this.equipment?.image || null;

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
				}
			});

		this.newImageUploadedEvent$
			.pipe(untilDestroyed(this))
			.subscribe(async (resultData) => {
				const newAsset = {
					name: resultData['original_filename'],
					url: resultData.url,
					width: resultData.width,
					height: resultData.height,
					isFeatured: false,
					organizationId: this.organization.id,
					tenantId: this.store.user.tenantId
				};

				let result = await this.imageAssetService.createImageAsset(
					newAsset
				);

				if (result) {
					this.toastrService.success('INVENTORY_PAGE.IMAGE_SAVED');

					this.newImageStoredEvent$.next(result);
				}
			});
	}

	async initializeForm() {
		this.form = this.fb.group({
			tags: [this.equipment ? this.equipment.tags : ''],
			name: [
				this.equipment ? this.equipment.name : '',
				Validators.required
			],
			type: [this.equipment ? this.equipment.type : ''],
			serialNumber: [this.equipment ? this.equipment.serialNumber : ''],
			manufacturedYear: [
				this.equipment ? this.equipment.manufacturedYear : null,
				[Validators.min(1000)]
			],
			initialCost: [
				this.equipment ? this.equipment.initialCost : null,
				[Validators.min(0)]
			],
			currency: [
				this.equipment
					? this.equipment.currency
					: this.selectedCurrency,
				Validators.required
			],
			maxSharePeriod: [
				this.equipment ? this.equipment.maxSharePeriod : null
			],
			autoApproveShare: [
				this.equipment ? this.equipment.autoApproveShare : false
			],
			id: [this.equipment ? this.equipment.id : null]
		});
		this.tags = this.form.get('tags').value || [];
	}

	async onAddImageClick() {
		const dialog = this.dialogService.open(SelectAssetComponent, {
			context: {
				newImageUploadedEvent: this.newImageUploadedEvent$,
				newImageStoredEvent: this.newImageStoredEvent$,
				settings: {
					selectMultiple: false,
					deleteImageEnabled: false,
					uploadImageEnabled: true
				}
			}
		});

		let selectedImage = await firstValueFrom(dialog.onClose);
		this.image = selectedImage ? selectedImage : this.image;
	}

	async saveEquipment() {
		if (!this.form.get('id').value) {
			delete this.form.value['id'];
		}
		const { tenantId } = this.store.user;
		const equipment = await this.equipmentService.save({
			...this.form.value,
			tags: this.tags,
			organizationId: this.selectedOrganization.id,
			image: this.image,
			tenantId
		});
		this.closeDialog(equipment);
	}

	async closeDialog(equipment?: IEquipment) {
		this.dialogRef.close(equipment);
	}

	selectedTagsEvent(currentTagSelection: ITag[]) {
		this.tags = currentTagSelection;
	}
}
