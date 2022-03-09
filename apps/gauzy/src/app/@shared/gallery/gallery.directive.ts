import {
	Directive,
	ComponentRef,
	HostListener,
	Input,
	ElementRef,
	OnDestroy,
	OnInit
} from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { sortBy } from 'underscore';
import { GalleryComponent } from './gallery.component';
import { GalleryService } from './gallery.service';

export interface GalleryItem {
	thumbUrl: string;
	fullUrl: string;
	recordedAt?: Date;
	employeeId?: string;
}

@Directive({
	selector: '[ngxGallery]'
})
export class GalleryDirective implements OnDestroy, OnInit {
	disableClick: boolean = false;
	dialogRef: ComponentRef<GalleryComponent>;

	@Input() employeeId: string;
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
		private readonly el: ElementRef,
		private readonly nbDialogService: NbDialogService,
		private readonly galleryService: GalleryService
	) {}

	@HostListener('click', [])
	onClick(): void {
		if (this.disableClick) {
			return;
		}

		let items = JSON.parse(JSON.stringify(this.item));
		items = sortBy(items, 'createdAt').reverse();

		const item = items instanceof Array ? items[0] : items;
		this.nbDialogService.open(GalleryComponent, {
			context: {
				items: this.items,
				item,
				employeeId: this.employeeId
			},
			dialogClass: 'fullscreen'
		});
	}

	ngOnInit() {
		const item = this.item instanceof Array ? this.item : [this.item];
		this.item = sortBy(item, 'createdAt');
		this.galleryService.appendItems(this.item);
	}

	ngOnDestroy() {}
}
