import { Component, OnDestroy, OnInit } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { Subject, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IImageAsset, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ImageAssetService, InventoryStore, ProductService, Store, ToastrService } from '@gauzy/ui-core/core';
import { GalleryComponent, GalleryService, ImageAssetComponent, SelectAssetComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-product-gallery',
    templateUrl: './product-gallery.component.html',
    styleUrls: ['./product-gallery.component.scss'],
    standalone: false
})
export class ProductGalleryComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	selectedImage: IImageAsset;
	gallery: IImageAsset[] = [];
	featuredImage: IImageAsset;

	organization: IOrganization;

	private newImageUploadedEvent$ = new Subject<any>();
	private newImageStoredEvent$ = new Subject<any>();

	get displayImageUrl() {
		if (this.selectedImage) return this.selectedImage.fullUrl;

		if (this.featuredImage) {
			return this.featuredImage.fullUrl;
		}

		return null;
	}

	constructor(
		public readonly translationService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly imageAssetService: ImageAssetService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly productService: ProductService,
		private readonly nbDialogService: NbDialogService,
		private readonly galleryService: GalleryService,
		private readonly inventoryStore: InventoryStore
	) {
		super(translationService);
	}

	async ngOnInit() {
		this.inventoryStore.activeProduct$.pipe(untilDestroyed(this)).subscribe((activeProduct) => {
			this.gallery = activeProduct.gallery;
			this.featuredImage = activeProduct.featuredImage;
		});

		this.store.selectedOrganization$.pipe(untilDestroyed(this)).subscribe((organization: IOrganization) => {
			if (organization) {
				this.organization = organization;
			}
		});

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

	async onAddImageClick() {
		const dialog = this.dialogService.open(SelectAssetComponent, {
			context: {
				newImageUploadedEvent: this.newImageUploadedEvent$,
				newImageStoredEvent: this.newImageStoredEvent$,
				settings: {
					selectMultiple: true,
					deleteImageEnabled: true,
					uploadImageEnabled: true
				}
			}
		});

		let selectedImages = await firstValueFrom(dialog.onClose);
		if (!selectedImages) return;
		selectedImages = selectedImages.length
			? selectedImages.filter((image) => {
					return !this.inventoryStore.gallery.find((galleryImg) => {
						return galleryImg.id == image.id || galleryImg.name == image.name;
					});
			  })
			: [];

		try {
			if (selectedImages.length && this.inventoryStore.activeProduct.id) {
				let resultProduct = await this.productService.addGalleryImages(
					this.inventoryStore.activeProduct.id,
					selectedImages
				);

				this.inventoryStore.activeProduct = resultProduct;
				this.toastrService.success('INVENTORY_PAGE.IMAGE_ADDED_TO_GALLERY');
			} else if (selectedImages.length && !this.inventoryStore.activeProduct.id) {
				this.inventoryStore.addGalleryImages(selectedImages);
				this.toastrService.success('INVENTORY_PAGE.IMAGE_ADDED_TO_GALLERY');
			}
		} catch (err) {
			this.toastrService.danger('Something bad happened');
		}
	}

	onSmallImgPreviewClick($event: IImageAsset) {
		this.selectedImage = $event;
	}

	async onSetFeaturedClick() {
		if (this.selectedImage && !this.inventoryStore.activeProduct.id) {
			this.inventoryStore.updateFeaturedImage(this.selectedImage);
			this.toastrService.success('INVENTORY_PAGE.FEATURED_IMAGE_WAS_SAVED');
			return;
		}

		try {
			let result = await this.productService.setAsFeatured(
				this.inventoryStore.activeProduct.id,
				this.selectedImage
			);

			if (result) {
				this.inventoryStore.updateFeaturedImage(this.selectedImage);

				this.toastrService.success('INVENTORY_PAGE.FEATURED_IMAGE_WAS_SAVED');
			}
		} catch (err) {
			this.toastrService.danger('Something bad happened!');
		}
	}

	async onDeleteImageClick() {
		if (!this.selectedImage) return;

		try {
			if (!this.inventoryStore.activeProduct.id) {
				this.inventoryStore.deleteGalleryImage(this.selectedImage);
			} else {
				let result = await this.productService.deleteGalleryImage(
					this.inventoryStore.activeProduct.id,
					this.selectedImage
				);

				if (result) {
					this.onDeleteGalleryImage();
					this.inventoryStore.activeProduct = result;
				}
			}

			this.selectedImage = null;
			this.toastrService.success('INVENTORY_PAGE.IMAGE_WAS_DELETED');
		} catch (err) {
			this.toastrService.danger(err.error.message || 'Something bad happened!');
		}
	}

	onViewGalleryClick() {
		const mappedImages = this.gallery.map((image) => {
			return {
				id: image.id,
				thumbUrl: image.fullUrl,
				fullUrl: image.fullUrl
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

	isSelected(image: IImageAsset) {
		if (!this.selectedImage || !image) return false;

		return image.fullUrl == this.selectedImage.fullUrl;
	}

	isFeaturedImage(image: IImageAsset) {
		if (!this.inventoryStore.activeProduct.featuredImage) return false;
		return this.inventoryStore.activeProduct.featuredImage.id == image.id;
	}

	async onDeleteGalleryImage() {
		const { activeProduct } = this.inventoryStore;
		if (activeProduct.featuredImage && activeProduct.featuredImage.id == this.selectedImage.id) {
			await this.productService.deleteFeaturedImage(activeProduct.id);
		}
	}

	onEditImageClick() {
		this.dialogService
			.open(ImageAssetComponent, {
				context: {
					imageAsset: this.selectedImage
				}
			})
			.onClose.pipe(take(1))
			.subscribe((res) => {
				if (!res || !res.id) return;

				let idx = this.gallery.indexOf(this.selectedImage);
				this.gallery[idx] = res;
				this.selectedImage = res;
			});
	}

	ngOnDestroy(): void {}
}
