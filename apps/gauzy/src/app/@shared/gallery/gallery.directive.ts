import {
	Directive,
	ComponentRef,
	HostListener,
	EmbeddedViewRef,
	Input,
	ElementRef,
	ComponentFactoryResolver,
	ApplicationRef,
	Injector,
	ViewContainerRef,
	OnDestroy,
	OnInit
} from '@angular/core';
import { GalleryComponent } from './gallery.component';
import { NbDialogService } from '@nebular/theme';
import { untilDestroyed } from 'ngx-take-until-destroy';

@Directive({
	selector: '[galleryPopup]'
})
export class GalleryDirective implements OnDestroy, OnInit {
	disable_click = false;
	_group_id: string;
	_similer: any;

	_items: string;
	dialogRef: ComponentRef<GalleryComponent>;

	@Input() set groupId(value: any) {
		this._group_id = value;
		this.el.nativeElement.setAttribute('groupId', value);
	}

	@Input()
	set items(value: any) {
		this._items = value;
	}
	get items(): any {
		return this._items;
	}

	@Input() set disabled(value: any) {
		this.disable_click = value || false;
		if (this.disable_click) {
			this.el.nativeElement.classList.add('disabled');
		} else {
			this.el.nativeElement.classList.remove('disabled');
		}
	}

	constructor(
		private el: ElementRef,
		private nbDialogService: NbDialogService
	) {}

	@HostListener('click', ['$event'])
	onClick($event): void {
		if (this.disable_click) {
			return;
		}

		this.nbDialogService
			.open(GalleryComponent, {
				context: {
					onNext: this.next,
					onPrev: this.prev,
					items: this.items
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.close();
			});
	}

	ngOnInit() {}

	close() {}

	next() {}

	prev() {}

	ngOnDestroy() {}
}
