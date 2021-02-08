import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IImageAsset } from '@gauzy/contracts';
import { NbDialogRef, NbToastrService } from '@nebular/theme';

import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ImageAssetService } from '../../@core/services/image-asset.service';
import { TranslationBaseComponent } from '../language-base/translation-base.component';

@UntilDestroy()
@Component({
	selector: 'ga-image-asset',
	templateUrl: './image-asset.component.html',
	styleUrls: ['./image-asset.component.scss']
})
export class ImageAssetComponent
	extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	@Input() imageAsset: IImageAsset;

	constructor(
		private fb: FormBuilder,
		readonly translateService: TranslateService,
		private imageAssetService: ImageAssetService,
		private dialogRef: NbDialogRef<ImageAssetComponent>,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.form = this.fb.group({
			name: [
				this.imageAsset ? this.imageAsset.name : null,
				Validators.required
			],
			url: [this.imageAsset ? this.imageAsset.url : null],
			width: [this.imageAsset ? this.imageAsset.width : null],
			height: [this.imageAsset ? this.imageAsset.height : null]
		});
	}

	async onSaveRequest() {
		const request = { ...this.imageAsset, ...this.form.value };
		this.imageAssetService
			.updateImageAsset(request)
			.then((res) => {
				this.toastrService.success(
					'INVENTORY_PAGE.IMAGE_ASSET.UPDATED'
				);

				this.dialogRef.close(request);
			})
			.catch((err) => {
				this.toastrService.success(
					'INVENTORY_PAGE.IMAGE_ASSET.UPDATED'
				);
			});
	}

	async onCancel() {
		this.dialogRef.close();
	}
}
