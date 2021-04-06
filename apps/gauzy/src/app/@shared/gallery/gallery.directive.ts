import {
	Directive,
	ComponentRef,
	HostListener,
	Input,
	ElementRef,
	OnDestroy,
	OnInit
} from '@angular/core';
import { GalleryComponent } from './gallery.component';
import { NbDialogService } from '@nebular/theme';
import { GalleryService } from './gallery.service';
import * as _ from 'underscore';

export interface GalleryItem {
	thumbUrl: string;
	fullUrl: string;
}

@Directive({
	selector: '[ngxGallery]'
})
export class GalleryDirective implements OnDestroy, OnInit {
	disableClick = false;
	_items: string;
	dialogRef: ComponentRef<GalleryComponent>;

	@Input() item: GalleryItem | GalleryItem[];

	@Input() items: GalleryItem[] = [];

	@Input() set disabled(value: any) {
		this.disableClick = value || false;
		if (this.disableClick) {
			this.el.nativeElement.classList.add('disabled');
		} else {
			this.el.nativeElement.classList.remove('disabled');
		}
	}

	constructor(
		private el: ElementRef,
		private nbDialogService: NbDialogService,
		private galleryService: GalleryService
	) {}

	@HostListener('click', [])
	onClick(): void {
		if (this.disableClick) {
			return;
		}

		let items = JSON.parse(JSON.stringify(this.item));
		items = _.sortBy(items, 'createdAt').reverse();

		const item = items instanceof Array ? items[0] : items;
		this.nbDialogService.open(GalleryComponent, {
			context: {
				items: this.items,
				item
			},
			dialogClass: 'fullscreen'
		});
	}

	ngOnInit() {
		this.item = _.sortBy(this.item, 'createdAt');
		this.galleryService.appendItems(this.item);
	}

	ngOnDestroy() {}
}
