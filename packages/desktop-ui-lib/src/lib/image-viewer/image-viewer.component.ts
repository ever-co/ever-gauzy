import {
	Component,
	OnInit,
	ViewChild,
	ElementRef,
	NgZone
} from '@angular/core';
import { transition, trigger, style, animate } from '@angular/animations';
import { ElectronServices } from '../electron/services';
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
	selector: 'ngx-image-viewer',
	templateUrl: './image-viewer.component.html',
	styleUrls: ['./image-viewer.component.scss'],
	animations: [fadeInOutAnimation]
})
export class ImageViewerComponent implements OnInit {
	active_index: any;

	@ViewChild('customScroll', { static: true })
	customScroll: ElementRef<HTMLElement>;

	items = [];

	item: any = {};
	constructor(
		// private dialogRef: NbDialogRef<any>
		private electronService: ElectronServices,
		private readonly _ngZone: NgZone
	) {
		this.electronService.ipcRenderer.on('show_image', (event, arg) => {
			this._ngZone.run(() => {
				this.items = arg.sort((a, b) => {
					const c: any = new Date(b.createdAt);
					const d: any = new Date(a.createdAt);
					return c - d;
				});
				this.item = this.items[0];
			});
		});
	}

	ngOnInit(): void {
		this.active_index = 0;
	}

	close() {
		// this.dialogRef.close();
		this.electronService.ipcRenderer.send('close_image_view');
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

	setFocus(selectedItem) {
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
		const activeItem =
			this.customScroll.nativeElement.querySelector('.thumb-item-active');
		if (activeItem) {
			const position = activeItem.getBoundingClientRect();
			if (position) {
				const left: any = position.left;
				const right: any = position.left + activeItem.clientWidth;
				const scrollRight: any =
					this.customScroll.nativeElement.clientWidth;
				const scrollLeft: any =
					this.customScroll.nativeElement.scrollLeft;

				if (left < Math.abs(scrollLeft) || right > scrollRight) {
					this.customScroll.nativeElement.scrollTo({
						left: left
					});
				}
			}
		}
	}
}
