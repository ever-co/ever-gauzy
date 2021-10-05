import {
	Component,
	OnInit,
	ElementRef,
	Input,
	ViewChild,
	OnDestroy
} from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { NbDialogRef } from '@nebular/theme';
import { GalleryItem } from './gallery.directive';
import { GalleryService } from './gallery.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { saveAs } from 'file-saver';

export const fadeInOutAnimation = trigger('fadeInOut', [
	transition(':enter', [
		// :enter is alias to 'void => *'
		style({ opacity: 0 }),
		animate(300, style({ opacity: 1 }))
	]),
	transition(':leave', [
		// :leave is alias to '* => void'
		animate(300, style({ opacity: 0 }))
	])
]);

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gallery',
	templateUrl: './gallery.component.html',
	styleUrls: ['./gallery.component.scss'],
	animations: [fadeInOutAnimation]
})
export class GalleryComponent implements OnInit, OnDestroy {
	active_index: any;

	@ViewChild('customScroll', { static: true })
	customScroll: ElementRef<HTMLElement>;

	@Input() item: GalleryItem;
	items: GalleryItem[] = [];

	constructor(
		private dialogRef: NbDialogRef<GalleryComponent>,
		private galleryService: GalleryService
	) { }

	ngOnInit() {
		this.galleryService.items$
			.pipe(untilDestroyed(this))
			.subscribe((items) => {
				this.items = items;
				this.setFocus(this.item);
			});
	}

	close() {
		this.dialogRef.close();
	}

	next($event) {
		$event.stopPropagation();
		this.active_index = Math.min(
			this.active_index + 1,
			this.items.length - 1
		);
		this.item = this.items[this.active_index];
		this.updateActiveIndex();
	}

	prev($event) {
		$event.stopPropagation();
		this.active_index = Math.max(this.active_index - 1, 0);
		this.item = this.items[this.active_index];
		this.updateActiveIndex();
	}

	setFocus(selectedItem: GalleryItem) {
		const foundItem = this.items.find(
			(item) => item.fullUrl === selectedItem.fullUrl
		);
		if (this.item) {
			const index = this.items.indexOf(this.item);
			this.active_index = index;
			this.item = foundItem;
		} else {
			this.item = selectedItem;
		}
		this.updateActiveIndex();
	}

	updateActiveIndex() {
		const activeItem = this.customScroll.nativeElement.querySelector(
			'.thumb-item-active'
		);
		if (activeItem) {
			const position = activeItem.getBoundingClientRect();
			if (position) {
				const left: any = position.left;
				const right: any = position.left + activeItem.clientWidth;
				const scrollRight: any = this.customScroll.nativeElement
					.clientWidth;
				const scrollLeft: any = this.customScroll.nativeElement
					.scrollLeft;

				if (left < Math.abs(scrollLeft) || right > scrollRight) {
					this.customScroll.nativeElement.scrollTo({
						left: left
					});
				}
			}
		}
	}

	ngOnDestroy() { }

	downloadFile(url: string) {
		if(url) {
			this.galleryService
			.downloadFile(url)
			.subscribe(blob => {
				saveAs(blob, url.replace(/^.*[\\\/]/, ''))
			});
		}		
	}
}
