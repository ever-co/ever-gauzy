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
import { IEmployee, IScreenshot } from '@gauzy/contracts';
import { GalleryComponent } from './gallery.component';
import { GalleryService } from './gallery.service';

export interface GalleryItem {
	id?: string;
	thumbUrl: string;
	fullUrl: string;
	recordedAt?: Date;
	employeeId?: string;
	description?: IScreenshot['description'];
	isWorkRelated?: IScreenshot['isWorkRelated'];
}

@Directive({
    selector: '[ngxGallery]',
    standalone: false
})
export class GalleryDirective implements OnDestroy, OnInit {
	public disableClick: boolean = false;
	public dialogRef: ComponentRef<GalleryComponent>;

	// Inputs
	@Input() items: GalleryItem[] = [];
	@Input() item: GalleryItem;
	@Input() employeeId: IEmployee['id'];

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
		let item = JSON.parse(JSON.stringify(this.item));
		// Extract the first item from the sorted array
		item = item instanceof Array ? item[0] : item;

		// Open a dialog (possibly a gallery) using NbDialogService
		this.nbDialogService.open(GalleryComponent, {
			context: {
				item,
				employeeId: this.employeeId
			},
			dialogClass: 'fullscreen'
		});
	}

	ngOnInit() {
		// Check if 'item' is an array; if not, convert it to a single-element array
		const items = this.items instanceof Array ? this.items : [this.items];
		// Sort the 'item' array by 'createdAt'
		this.items = sortBy(items, 'recordedAt');

		// Append the sorted 'item' array to the gallery service
		this.galleryService.appendItems(this.items);
	}

	ngOnDestroy() { }
}
