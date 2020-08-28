import {
	Directive,
	OnDestroy,
	OnInit,
	QueryList,
	AfterViewInit,
	ContentChildren
} from '@angular/core';
import { GalleryDirective } from './gallery.directive';
import { untilDestroyed } from 'ngx-take-until-destroy';

@Directive({
	selector: '[ngxGalleryContainer]'
})
export class GalleryContainerDirective
	implements OnDestroy, OnInit, AfterViewInit {
	@ContentChildren(GalleryDirective, { descendants: true })
	galleryItems: QueryList<GalleryDirective>;

	constructor() {}

	ngOnInit(): void {}

	ngAfterViewInit() {
		this.galleryItems.changes
			.pipe(untilDestroyed(this))
			.subscribe((value) => {
				this.updateItems();
			});
	}

	updateItems() {
		if (this.galleryItems) {
			let allItems = [];
			this.galleryItems.forEach((galleryItem) => {
				if (galleryItem.item instanceof Array) {
					allItems = allItems.concat(galleryItem.item);
				} else {
					allItems.push(galleryItem.item);
				}
			});
			this.galleryItems.forEach((galleryItem) => {
				galleryItem.items = allItems;
			});
		}
	}

	ngOnDestroy() {}
}
