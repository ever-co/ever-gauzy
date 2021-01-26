import {
	Component,
	EventEmitter,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	Output,
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
import { GalleryComponent } from 'apps/gauzy/src/app/@shared/gallery/gallery.component';
import { GalleryService } from 'apps/gauzy/src/app/@shared/gallery/gallery.service';
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

	@Output() galleryUpdated = new EventEmitter<IImageAsset[]>();
	@Output() featuredImageUpdated = new EventEmitter<IImageAsset>();

	private newImageUploadedEvent$ = new Subject<any>();
	private newImageStoredEvent$ = new Subject<any>();

	constructor(
		readonly translationService: TranslateService,
		private dialogService: NbDialogService,
		private imageAssetService: ImageAssetService,
		private toastrService: ToastrService,
		private store: Store,
		private productService: ProductService,
		private nbDialogService: NbDialogService,
		private galleryService: GalleryService
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

					this.availableImages.push(result);
				}
			});
	}

	async onAddImageClick() {
		const dialog = this.dialogService.open(SelectAssetComponent, {
			context: {
				gallery: this.availableImages,
				newImageUploadedEvent: this.newImageUploadedEvent$,
				newImageStoredEvent: this.newImageStoredEvent$
			}
		});

		let selectedImage = await dialog.onClose.pipe(first()).toPromise();

		if (selectedImage && !this.inventoryItem) {
			this.gallery.push(selectedImage);
			this.galleryUpdated.emit(this.gallery);
			this.toastrService.success('INVENTORY_PAGE.IMAGE_ADDED_TO_GALLERY');
		}

		if (selectedImage && this.inventoryItem) {
			let resultProduct = await this.productService.addGalleryImage(
				this.inventoryItem.id,
				selectedImage
			);
			this.gallery = resultProduct.gallery;
			this.toastrService.success('INVENTORY_PAGE.IMAGE_ADDED_TO_GALLERY');
		}
	}

	onSmallImgPreviewClick($event: IImageAsset) {
		this.selectedImage = $event;
	}

	async onSetFeaturedClick() {
		if (this.selectedImage && !this.inventoryItem) {
			this.featuredImageUpdated.emit(this.selectedImage);
			return;
		}

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

	async onDeleteImageClick() {
		if (!this.selectedImage) return;

		if (this.selectedImage && !this.inventoryItem) {
			this.featuredImageUpdated.emit(this.selectedImage);
			this.deleteGalleryImage();
			return;
		}

		if (this.selectedImage && this.inventoryItem) {
			try {
				let result = await this.productService.deleteGalleryImage(
					this.inventoryItem.id,
					this.selectedImage
				);

				if (result) {
					this.deleteGalleryImage();
				}
			} catch (err) {
				this.toastrService.danger('Something bad happened!');
			}
		}
	}

	onViewGalleryClick() {
		const mappedImages = this.gallery.map((image) => {
			return {
				thumbUrl: image.url,
				fullUrl: image.url
			};
		});

		this.galleryService.appendItems(mappedImages);

		this.nbDialogService.open(GalleryComponent, {
			context: {
				items: mappedImages,
				item: mappedImages[0]
			},
			dialogClass: 'fullscreen'
		});
	}

	private deleteGalleryImage() {
		this.gallery = this.gallery.filter(
			(img) => img.id !== this.selectedImage.id
		);
		this.selectedImage = null;
		this.toastrService.success('INVENTORY_PAGE.IMAGE_WAS_DELETED');
	}

	ngOnDestroy(): void {}
}
