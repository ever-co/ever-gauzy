import { OnInit, Component } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { IEquipment, ITag, IOrganization, IImageAsset } from '@gauzy/contracts';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject, firstValueFrom, filter, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { environment as ENV } from '@gauzy/ui-config';
import { EquipmentService, ImageAssetService, ToastrService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { SelectAssetComponent } from '../select-asset-modal/select-asset.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-equipment-mutation',
	templateUrl: './equipment-mutation.component.html',
	styleUrls: ['./equipment-mutation.component.scss']
})
export class EquipmentMutationComponent extends TranslationBaseComponent implements OnInit {
	form: UntypedFormGroup;
	equipment: IEquipment;
	image: IImageAsset;
	selectedCurrency: string;
	organization: IOrganization;
	hoverState = false;

	private newImageUploadedEvent$ = new Subject<any>();
	private newImageStoredEvent$ = new Subject<any>();

	constructor(
		public readonly dialogRef: NbDialogRef<EquipmentMutationComponent>,
		private readonly dialogService: NbDialogService,
		private readonly equipmentService: EquipmentService,
		private readonly fb: UntypedFormBuilder,
		readonly translationService: TranslateService,
		readonly store: Store,
		private readonly imageAssetService: ImageAssetService,
		private readonly toastrService: ToastrService
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
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this.newImageUploadedEvent$.pipe(untilDestroyed(this)).subscribe(async (resultData) => {
			const newAsset = {
				name: resultData['original_filename'],
				url: resultData.url,
				width: resultData.width,
				height: resultData.height,
				isFeatured: false,
				organizationId: this.organization.id,
				tenantId: this.store.user.tenantId
			};

			let result = await this.imageAssetService.createImageAsset(newAsset);
			if (result) {
				this.toastrService.success('INVENTORY_PAGE.IMAGE_SAVED');
				this.newImageStoredEvent$.next(result);
			}
		});
	}

	async initializeForm() {
		this.form = this.fb.group({
			tags: [this.equipment ? this.equipment.tags : []],
			name: [this.equipment ? this.equipment.name : '', Validators.required],
			type: [this.equipment ? this.equipment.type : ''],
			serialNumber: [this.equipment ? this.equipment.serialNumber : ''],
			manufacturedYear: [this.equipment ? this.equipment.manufacturedYear : null, [Validators.min(1000)]],
			initialCost: [this.equipment ? this.equipment.initialCost : null, [Validators.min(0)]],
			currency: [this.equipment ? this.equipment.currency : this.selectedCurrency, Validators.required],
			maxSharePeriod: [this.equipment ? this.equipment.maxSharePeriod : null],
			autoApproveShare: [this.equipment ? this.equipment.autoApproveShare : false],
			id: [this.equipment ? this.equipment.id : null]
		});
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
		if (!this.organization) {
			return;
		}
		if (!this.form.get('id').value) {
			delete this.form.value['id'];
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const equipment = await this.equipmentService.save({
			...this.form.value,
			tenantId,
			organizationId,
			image: this.image
		});
		this.closeDialog(equipment);
	}

	async closeDialog(equipment?: IEquipment) {
		this.dialogRef.close(equipment);
	}

	selectedTagsEvent(selectedTags: ITag[]) {
		this.form.get('tags').setValue(selectedTags);
		this.form.get('tags').updateValueAndValidity();
	}
}
