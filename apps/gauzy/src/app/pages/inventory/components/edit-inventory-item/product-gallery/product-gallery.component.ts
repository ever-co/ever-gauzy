import {
	Component,
	EventEmitter,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	SimpleChanges
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
import { ProductService } from 'apps/gauzy/src/app/@core/services/product.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { SelectAssetComponent } from 'apps/gauzy/src/app/@shared/select-asset-modal/select-asset.component';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-gallery',
	templateUrl: './product-gallery.component.html',
	styleUrls: ['./product-gallery.component.scss']
})
export class ProductGalleryComponent
	extends TranslationBaseComponent
	implements OnInit, OnChanges, OnDestroy {
	@Input('inventoryItem') inventoryItem: IProductTranslatable;

	selectedImage: IImageAsset;
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
		private store: Store,
		private productService: ProductService
	) {
		super(translationService);
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes.inventoryItem && changes.inventoryItem.currentValue) {
			this.inventoryItem = changes.inventoryItem.currentValue;
			this.gallery = this.inventoryItem.gallery;
			this.selectedImage = this.inventoryItem.featuredImage;
		}
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
			.pipe(untilDestroyed(this))
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

	async onAddImageClick() {
		const dialog = this.dialogService.open(SelectAssetComponent, {
			context: {
				gallery: this.availableImages,
				newImageUploadedEvent: this.newImageUploadedEvent$
			}
		});

		let selectedImage = await dialog.onClose.pipe(first()).toPromise();

		if (selectedImage) {
			let resultProduct = await this.productService.addGalleryImage(
				this.inventoryItem.id,
				selectedImage
			);
			this.gallery = resultProduct.gallery;
		}
	}

	onSmallImgPreviewClick($event: IImageAsset) {
		this.selectedImage = $event;
	}

	async onSetFeaturedClick() {
		try {
			let result = await this.productService.setAsFeatured(
				this.inventoryItem.id,
				this.selectedImage
			);

			if (result) {
				this.toastrService.success(
					'INVENTORY_PAGE.FEATURED_IMAGE_WAS_SAVED'
				);
			}
		} catch (err) {
			this.toastrService.danger('Something bad happened!');
		}
	}

	ngOnDestroy(): void {}
}
