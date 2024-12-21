import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IImageAsset } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ImageAssetService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
    selector: 'ga-image-asset',
    templateUrl: './image-asset.component.html',
    styleUrls: ['./image-asset.component.scss'],
    standalone: false
})
export class ImageAssetComponent extends TranslationBaseComponent implements OnInit {
	form: UntypedFormGroup;
	@Input() imageAsset: IImageAsset;

	constructor(
		private readonly fb: UntypedFormBuilder,
		public readonly translateService: TranslateService,
		private readonly imageAssetService: ImageAssetService,
		private readonly dialogRef: NbDialogRef<ImageAssetComponent>,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.form = this.fb.group({
			name: [null, Validators.required],
			url: [null],
			width: [null],
			height: [null]
		});

		if (this.imageAsset)
			this.form.patchValue({
				name: this.imageAsset.name,
				url: this.imageAsset.fullUrl,
				width: this.imageAsset.width,
				height: this.imageAsset.height
			});
	}

	async onSaveRequest() {
		const request = { id: this.imageAsset.id, ...this.form.value };
		this.imageAssetService
			.updateImageAsset(request)
			.then((res) => {
				this.toastrService.success('INVENTORY_PAGE.IMAGE_ASSET_UPDATED');

				this.dialogRef.close(request);
			})
			.catch((err) => {
				this.toastrService.success('Could not save image');
			});
	}

	async onCancel() {
		this.dialogRef.close();
	}
}
