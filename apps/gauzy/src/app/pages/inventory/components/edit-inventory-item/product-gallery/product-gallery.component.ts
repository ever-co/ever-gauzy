import {
	Component,
	EventEmitter,
	Input,
	OnDestroy,
	OnInit
} from '@angular/core';
import {
	IImageAsset,
	IOrganization,
	IProductTranslatable
} from '@gauzy/models';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ImageAssetService } from 'apps/gauzy/src/app/@core/services/image-asset.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { SelectAssetComponent } from 'apps/gauzy/src/app/@shared/select-asset-modal/select-asset.component';
import { Subject } from 'rxjs';
import { take } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-gallery',
	templateUrl: './product-gallery.component.html',
	styleUrls: ['./product-gallery.component.scss']
})
export class ProductGalleryComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input('inventoryItem') inventoryItem: IProductTranslatable;
	gallery: IImageAsset[] = [];
	availableImages: IImageAsset[] = [];

	organization: IOrganization;

	newImageUploadedEvent = new EventEmitter<any>();
	private newImageUploadedEvent$ = new Subject<any>();

	constructor(
		readonly translationService: TranslateService,
		private dialogService: NbDialogService,
		private imageAssetService: ImageAssetService,
		private toastrService: ToastrService,
		private store: Store
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.gallery = this.inventoryItem ? this.inventoryItem.gallery : [];

		this.getAvailableImages();

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.getAvailableImages();
				}
			});

		this.newImageUploadedEvent$
			.pipe(take(1))
			.subscribe(async (resultData) => {
				const newAsset = {
					name: resultData['original_filename'],
					url: resultData.url,
					width: resultData.width,
					height: resultData.height,
					isFeatured: false
				};

				let result = await this.imageAssetService.createImageAsset(
					newAsset
				);

				if (result) {
					this.toastrService.success('INVENTORY_PAGE.IMAGE_SAVED');

					this.availableImages.push(result);
				}
			});
	}

	async getAvailableImages() {
		//tstodo save image with tenant and organization

		// const { tenantId } = this.store.user;

		// let searchInput: any = { tenantId };

		// if (this.organization && this.organization.id) {
		// 	searchInput.organizationId = this.organization.id;
		// }

		this.availableImages = (await this.imageAssetService.getAll({})).items;
	}

	onAddImageClick() {
		//tstodo
		// const dialog = this.dialogService.open(SelectAssetComponent, {
		// 	context: {
		// 		gallery: this.availableImages,
		// 		newImageUploadedEvent: this.newImageUploadedEvent$
		// 	}
		// });
	}

	ngOnDestroy(): void {}
}
