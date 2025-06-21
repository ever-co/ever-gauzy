import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'camshot-viewer',
	templateUrl: './camshot-viewer.component.html',
	styleUrls: ['./camshot-viewer.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CamshotViewerComponent {
	imageUrl: string;
	imageTitle: string;
	imageDescription: string;

	isZoomed = false;
	isLoading = true;
	showError = false;
	zoomLevel = 1;
	isDragging = false;
	dragX = 0;
	dragY = 0;
	private dragStartX = 0;
	private dragStartY = 0;

	constructor(protected dialogRef: NbDialogRef<CamshotViewerComponent>) {}

	public dismiss(): void {
		this.dialogRef.close();
	}

	public toggleZoom(): void {
		this.isZoomed = !this.isZoomed;
		this.zoomLevel = this.isZoomed ? 1.5 : 1;
		if (!this.isZoomed) {
			this.resetPosition();
		}
	}

	public zoomIn(): void {
		if (this.zoomLevel < 3) {
			this.zoomLevel += 0.25;
			this.isZoomed = true;
		}
	}

	public zoomOut(): void {
		if (this.zoomLevel > 0.5) {
			this.zoomLevel -= 0.25;
			this.isZoomed = this.zoomLevel !== 1;
			if (!this.isZoomed) {
				this.resetPosition();
			}
		}
	}

	public resetZoom(): void {
		this.zoomLevel = 1;
		this.isZoomed = false;
		this.resetPosition();
	}

	public resetPosition(): void {
		this.dragX = 0;
		this.dragY = 0;
	}

	public onImageLoad(): void {
		this.isLoading = false;
		this.showError = false;
	}

	public onImageError(): void {
		this.isLoading = false;
		this.showError = true;
	}

	@HostListener('mousedown', ['$event'])
	onMouseDown(event: MouseEvent): void {
		if (this.isZoomed && event.button === 0) {
			this.isDragging = true;
			this.dragStartX = event.clientX - this.dragX;
			this.dragStartY = event.clientY - this.dragY;
		}
	}

	@HostListener('document:mousemove', ['$event'])
	onMouseMove(event: MouseEvent): void {
		if (this.isDragging) {
			this.dragX = event.clientX - this.dragStartX;
			this.dragY = event.clientY - this.dragStartY;
		}
	}

	@HostListener('document:mouseup')
	onMouseUp(): void {
		this.isDragging = false;
	}

	@HostListener('touchstart', ['$event'])
	onTouchStart(event: TouchEvent): void {
		if (this.isZoomed && event.touches.length === 1) {
			this.isDragging = true;
			this.dragStartX = event.touches[0].clientX - this.dragX;
			this.dragStartY = event.touches[0].clientY - this.dragY;
		}
	}

	@HostListener('document:touchmove', ['$event'])
	onTouchMove(event: TouchEvent): void {
		if (this.isDragging && event.touches.length === 1) {
			this.dragX = event.touches[0].clientX - this.dragStartX;
			this.dragY = event.touches[0].clientY - this.dragStartY;
		}
	}

	@HostListener('document:touchend')
	onTouchEnd(): void {
		this.isDragging = false;
	}
}
