import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IImageAsset } from '@gauzy/contracts';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ImageAssetService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DeleteConfirmationComponent } from '../../user/forms/delete-confirmation/delete-confirmation.component';

@Component({
    selector: 'ngx-img-asset',
    templateUrl: './img-asset.component.html',
    styleUrls: ['./img-asset.component.scss'],
    standalone: false
})
export class NgxImageAssetComponent extends TranslationBaseComponent implements OnInit {
	@Input()
	imageAsset: IImageAsset;

	@Input()
	selectedImages: IImageAsset[] = [];
	@Input()
	deleteImageEnabled: boolean;

	@Output() imageClicked = new EventEmitter<any>();
	@Output() assetDeleted = new EventEmitter<any>();

	ngOnInit(): void {}

	constructor(
		public readonly translateService: TranslateService,
		private readonly imageAssetService: ImageAssetService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: NbToastrService
	) {
		super(translateService);
	}

	get selected() {
		if (!this.imageAsset || !this.selectedImages) return;

		return this.selectedImages.find((image) => image.fullUrl == this.imageAsset.fullUrl);
	}

	onImageClick($event) {
		this.imageClicked.emit(this.imageAsset);
	}

	async onDeleteAsset($event) {
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

		if (result) {
			await this.imageAssetService
				.deleteImageAsset(this.imageAsset)
				.then(() => {
					this.toastrService.success(
						this.getTranslation('INVENTORY_PAGE.IMAGE_ASSET_DELETED'),
						this.imageAsset.name
					);

					this.assetDeleted.emit(this.imageAsset);
				})
				.catch((err) => {
					this.toastrService.danger(err.error.message || 'Could not delete image', 'Error');
				});
		}
	}
}
