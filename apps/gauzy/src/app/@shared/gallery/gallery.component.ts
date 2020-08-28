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

@Component({
	selector: 'ngx-gallery',
	templateUrl: './gallery.component.html',
	styleUrls: ['./gallery.component.scss'],
	animations: [fadeInOutAnimation]
})
export class GalleryComponent implements OnInit, OnDestroy {
	private _item: GalleryItem;
	active_index: any;

	@ViewChild('customScroll', { static: true }) customScroll: ElementRef<
		HTMLElement
	>;

	@Input() items: GalleryItem[] = [];
	@Input() item: GalleryItem;

	constructor(private dialogRef: NbDialogRef<GalleryComponent>) {}

	ngOnInit() {
		this.setFocus(this.item);
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

	setFocus(item) {
		const index = this.items.indexOf(item);
		this.active_index = index;
		this._item = this.items[this.active_index];
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

	ngOnDestroy() {}
}
