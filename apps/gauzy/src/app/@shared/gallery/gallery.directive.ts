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

@Directive({
	selector: '[ngx-gallery]'
})
export class GalleryDirective implements OnDestroy, OnInit {
	disableClick = false;
	_items: string;
	dialogRef: ComponentRef<GalleryComponent>;

	@Input() item: string;

	@Input() items: string[];

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
		private nbDialogService: NbDialogService
	) {}

	@HostListener('click', [])
	onClick(): void {
		if (this.disableClick) {
			return;
		}

		this.nbDialogService.open(GalleryComponent, {
			context: {
				items: this.items,
				item: this.item
			},
			dialogClass: 'fullscreen'
		});
	}

	ngOnInit() {}

	ngOnDestroy() {}
}
