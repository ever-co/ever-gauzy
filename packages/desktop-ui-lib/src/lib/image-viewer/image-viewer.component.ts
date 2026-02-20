import { Component, OnInit, ViewChild, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { transition, trigger, style, animate } from '@angular/animations';
import { ElectronService } from '../electron/services';
import { SafeUrl } from '@angular/platform-browser';
import { ImageViewerService } from './image-viewer.service';
import { from } from 'rxjs';
import { NbIconLibraries, NbLayoutModule, NbButtonModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { NgTemplateOutlet, NgClass, AsyncPipe } from '@angular/common';
import { DateTimePipe } from '../time-tracker/pipes/date-time.pipe';

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
	animations: [fadeInOutAnimation],
	imports: [NbLayoutModule, NbButtonModule, NbIconModule, NbSpinnerModule, NgTemplateOutlet, NgClass, AsyncPipe, DateTimePipe]
})
export class ImageViewerComponent implements OnInit, OnDestroy {
	active_index: number;

	@ViewChild('customScroll', { static: true })
	customScroll: ElementRef<HTMLElement>;

	items = [];

	item: any = {};
	private readonly _showImageHandler = this.showImageEventHandler.bind(this);
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

	async showImageEventHandler(_, arg) {
		if (arg.timeSlotId) {
			const screenshots: any[] = await this.getLastScreenshot(arg.timeSlotId);
			this.getImages(screenshots);
		} else {
			this.getImages(arg.screenshots);
		}
	}

	getImages(screenshots: any[]) {
		this._ngZone.run(() => {
			this.items = screenshots
				.sort((a, b) => {
					const c: any = new Date(b.recordedAt);
					const d: any = new Date(a.recordedAt);
					return c - d;
				})
				.map((img) => ({
					...img,
					fullUrl: from(this.sanitizeImgUrl(img.fullUrl)),
					thumbUrl: from(this.sanitizeImgUrl(img.thumbUrl))
				}));
			this.item = this.items[0];
		});
	}

	ngOnInit(): void {
		this._electronService.ipcRenderer.on('show_image', this._showImageHandler);
		this._electronService.ipcRenderer.send('image_view_ready');
		this.active_index = 0;
	}

	ngOnDestroy(): void {
		this._electronService.ipcRenderer.removeListener('show_image', this._showImageHandler);
	}

	close() {
		// this.dialogRef.close();
		this._electronService.ipcRenderer.send('close_image_view');
	}

	next($event) {
		$event.stopPropagation();
		this.active_index = Math.min(this.active_index + 1, this.items.length - 1);
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
		const activeItem = this.customScroll.nativeElement.querySelector('.thumb-item-active');
		if (activeItem) {
			const position = activeItem.getBoundingClientRect();
			if (position) {
				const left: any = position.left;
				const right: any = position.left + activeItem.clientWidth;
				const scrollRight: any = this.customScroll.nativeElement.clientWidth;
				const scrollLeft: any = this.customScroll.nativeElement.scrollLeft;

				if (left < Math.abs(scrollLeft) || right > scrollRight) {
					this.customScroll.nativeElement.scrollTo({
						left: left
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

	private async getLastScreenshot(timeSlotId: string) {
		try {
			const lastTimeSlot = await this._imageViewerService.getTimeSlot({
				timeSlotId
			});
			return lastTimeSlot?.screenshots || [];
		} catch(err) {
			console.error('[ImageViewer] showImageEventHandler error:', err);
			return [];
		}
	}
}
