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
import { IScreenshot } from '@gauzy/contracts';
import { GalleryComponent } from './gallery.component';
import { GalleryService } from './gallery.service';

export interface GalleryItem {
	thumbUrl: string;
	fullUrl: string;
	recordedAt?: Date;
	employeeId?: string;
	description?: IScreenshot['description'];
	isWorkRelated?: IScreenshot['isWorkRelated'];
}

@Directive({
	selector: '[ngxGallery]'
})
export class GalleryDirective implements OnDestroy, OnInit {
	public disableClick: boolean = false;
	public dialogRef: ComponentRef<GalleryComponent>;

	// Inputs
	@Input() employeeId: string;
	@Input() item: GalleryItem | GalleryItem[];
	@Input() items: GalleryItem[] = [];

	// Input with Setter
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
	) { }

	/**
	 * Host listener for click events
	 */
	@HostListener('click', [])
	onClick(): void {
		// Check if clicking is disabled
		if (this.disableClick) {
			return;
		}

		// Deep copy the 'item' property
		let items = JSON.parse(JSON.stringify(this.item));

		// Sort the items array by 'createdAt' in descending order
		items = sortBy(items, 'createdAt').reverse();

		// Extract the first item from the sorted array
		const item = items instanceof Array ? items[0] : items;

		// Open a dialog (possibly a gallery) using NbDialogService
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
		// Check if 'item' is an array; if not, convert it to a single-element array
		const item = this.item instanceof Array ? this.item : [this.item];

		// Sort the 'item' array by 'createdAt'
		this.item = sortBy(item, 'createdAt');

		// Append the sorted 'item' array to the gallery service
		this.galleryService.appendItems(this.item);
	}

	ngOnDestroy() { }
}
