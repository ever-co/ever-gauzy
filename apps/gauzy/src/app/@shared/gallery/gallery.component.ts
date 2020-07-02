import {
	EventEmitter,
	Component,
	OnInit,
	ElementRef,
	Input,
	Output,
	ViewChild,
	OnDestroy
} from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';

declare let $: any;

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
	@ViewChild('imageMedia') imageMedia: ElementRef;
	@ViewChild('middelPart') middelPart: ElementRef;

	_active_index: any;
	set active_index(value) {
		this._active_index = value;

		const position = $('.thumb-item-' + this._active_index).position();
		if (position) {
			const left: any = position.left;
			const right: any =
				position.left + $('.thumb-item-' + this._active_index).width();

			const scrollRight: any = $('.thumb-items[custom-scroll]').width();

			if (left < Math.abs(this.scrollLeft) || right > scrollRight) {
				$('.thumb-items[custom-scroll]').mCustomScrollbar(
					'scrollTo',
					left
				);
			}
		}
	}
	get active_index() {
		return this._active_index;
	}

	scrollLeft: any = 0;
	customScrollOptions: any;
	apImageZoom: any;
	type = 'image';
	zoom: any = 0;

	img_ele: any = null;
	x_img_ele: any = 0;
	y_img_ele: any = 0;

	min_zoom: any = 0;
	max_zoom: any = 2;
	zoom_step: any = 0.1;

	el: Element;
	_group_id: string;
	item: any;
	_items: any;
	thumb_items: any;

	@Input() set data(value: any) {
		this.item = value;
	}

	@Input() set items(items: any) {
		this._items = items;

		this.thumb_items = [];
		this._items.each((index, value) => {
			const media = $(value).data('data');
			if (media.id === this.item.id) {
				this.active_index = index;
			}

			this.thumb_items.push({ media: media, ele: value });
		});
	}

	@Input() onNext: CallableFunction = () => {};
	@Input() onPrev: CallableFunction = () => {};

	constructor(el: ElementRef) {
		this.el = el.nativeElement;
	}

	ngOnInit() {}

	initData() {}

	close() {}

	next() {
		this.onNext();
		const index = Math.min(this.active_index, this.thumb_items.length - 2);
		this.active_index = index + 1;
		this.setFocus(this.active_index);
	}

	prev() {
		this.onPrev();
		const index = Math.max(this.active_index, 1);
		this.active_index = index - 1;
		this.setFocus(this.active_index);
	}

	setFocus(index) {
		this.active_index = index;
		this.data = this.thumb_items[index].media;
	}

	ngOnDestroy() {}
}
