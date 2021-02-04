import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IImageAsset } from '@gauzy/contracts';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { first } from 'rxjs/operators';
import { ImageAssetService } from '../../../@core/services/image-asset.service';
import { DeleteConfirmationComponent } from '../../user/forms/delete-confirmation/delete-confirmation.component';

@Component({
	selector: 'ngx-img-asset',
	templateUrl: './img-asset.component.html',
	styleUrls: ['./img-asset.component.scss']
})
export class ImageAssetComponent implements OnInit {
	@Input()
	imageAsset: IImageAsset;

	@Input()
	selectedImage: IImageAsset;
	@Input()
	deleteImageEnabled: boolean;

	@Output() imageClicked = new EventEmitter<any>();
	@Output() assetDeleted = new EventEmitter<any>();

	ngOnInit(): void {}

	constructor(
		private imageAssetService: ImageAssetService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService
	) {}

	get selected() {
		if (!this.imageAsset || !this.selectedImage) return;

		return this.imageAsset.url == this.selectedImage.url;
	}

	onImageClick($event) {
		this.imageClicked.emit(this.imageAsset);
	}

	async onDeleteAsset($event) {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.imageAssetService
				.deleteImageAsset(this.imageAsset)
				.then(() => {
					this.toastrService.success(
						'INVENTORY_PAGE.IMAGE_ASSET_DELETED',
						this.imageAsset.name
					);

					this.assetDeleted.emit(this.imageAsset);
				})
				.catch((err) => {
					this.toastrService.danger(
						err.error.message || 'Could not delete image',
						'Error'
					);
				});
		}
	}
}
