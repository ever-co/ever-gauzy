import {
	Component,
	OnInit,
	ViewChild,
	ElementRef,
	NgZone,
} from '@angular/core';
import { transition, trigger, style, animate } from '@angular/animations';
import { ElectronService } from '../electron/services';
import { SafeUrl } from '@angular/platform-browser';
import { ImageViewerService } from './image-viewer.service';
import { from } from 'rxjs';
import { NbIconLibraries } from '@nebular/theme';

export const fadeInOutAnimation = trigger('fadeInOut', [
	transition(':enter', [
		// :enter is alias to 'void => *'
		style({ opacity: 0 }),
		animate(300, style({ opacity: 1 })),
	]),
	transition(':leave', [
		// :leave is alias to '* => void'
		animate(300, style({ opacity: 0 })),
	]),
]);

@Component({
    selector: 'ngx-image-viewer',
    templateUrl: './image-viewer.component.html',
    styleUrls: ['./image-viewer.component.scss'],
    animations: [fadeInOutAnimation],
    standalone: false
})
export class ImageViewerComponent implements OnInit {
	active_index: any;

	@ViewChild('customScroll', { static: true })
	customScroll: ElementRef<HTMLElement>;

	items = [];

	item: any = {};
	constructor(
		// private dialogRef: NbDialogRef<any>
		private readonly _electronService: ElectronService,
		private readonly _ngZone: NgZone,
		private readonly _imageViewerService: ImageViewerService,
		private readonly _iconLibraries: NbIconLibraries
	) {
		this._iconLibraries.registerFontPack('font-awesome', {
			packClass: 'fas',
			iconClassPrefix: 'fa'
		});
	}

	ngOnInit(): void {
		this._electronService.ipcRenderer.on(
			'show_image',
			(event, arg: any[]) => {
				this._ngZone.run(() => {
					this.items = arg
						.sort((a, b) => {
							const c: any = new Date(b.recordedAt);
							const d: any = new Date(a.recordedAt);
							return c - d;
						})
						.map((img) => ({
							...img,
							fullUrl: from(this.sanitizeImgUrl(img.fullUrl)),
							thumbUrl: from(this.sanitizeImgUrl(img.thumbUrl)),
						}));
					this.item = this.items[0];
				});
			}
		);
		this.active_index = 0;
	}

	close() {
		// this.dialogRef.close();
		this._electronService.ipcRenderer.send('close_image_view');
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
		const foundItem = this.items.find((item) => item === selectedItem);
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
						left: left,
					});
				}
			}
		}
	}

	public async sanitizeImgUrl(img: string): Promise<SafeUrl> {
		return await this._imageViewerService.sanitizeImgUrl(img);
	}

	public trackById(index: number, item: any): number {
		return item.id;
	}
}
