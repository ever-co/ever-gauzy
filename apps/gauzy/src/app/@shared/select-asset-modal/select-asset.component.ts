import { Component, Input, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { ImageAssetComponent } from './img-asset/img-asset.component';
import { IImageAsset, IOrganization } from '@gauzy/models';
import { Subject } from 'rxjs';
import { Store } from '../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ImageAssetService } from '../../@core/services/image-asset.service';

@UntilDestroy()
@Component({
	selector: 'ngx-select-asset',
	templateUrl: './select-asset.component.html',
	styleUrls: ['./select-asset.component.scss']
})
export class SelectAssetComponent
	extends TranslationBaseComponent
	implements OnInit {
	selectedImage: ImageAssetComponent;

	gallery: IImageAsset[] = [];

	@Input() newImageUploadedEvent: Subject<any>;
	@Input() newImageStoredEvent: Subject<IImageAsset>;

	organization: IOrganization;

	constructor(
		public dialogRef: NbDialogRef<any>,
		readonly translationService: TranslateService,
		private imageAssetService: ImageAssetService,
		private store: Store
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.getAvailableImages();
				}
			});

		this.newImageStoredEvent
			.pipe(untilDestroyed(this))
			.subscribe((image: IImageAsset) => {
				this.gallery.push(image);
			});
	}

	async getAvailableImages() {
		const { tenantId } = this.store.user;

		let searchInput: any = {
			tenantId,
			organizationId: this.organization.id
		};

		this.gallery = (await this.imageAssetService.getAll(searchInput)).items;
	}

	onSelectImage($event) {
		this.selectedImage = $event;
	}

	onSelectImageClick() {
		this.dialogRef.close(this.selectedImage);
	}

	onImageUploaded(image: IImageAsset) {
		this.newImageUploadedEvent.next(image);
	}
}
