import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'camshot-viewer',
	standalone: false,
	templateUrl: './camshot-viewer.component.html',
	styleUrl: './camshot-viewer.component.scss',
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

	constructor(protected dialogRef: NbDialogRef<CamshotViewerComponent>) {}

	public dismiss() {
		this.dialogRef.close();
	}

	public toggleZoom() {
		this.isZoomed = !this.isZoomed;
		this.zoomLevel = this.isZoomed ? 1.5 : 1;
	}

	public zoomIn() {
		if (this.zoomLevel < 3) {
			this.zoomLevel += 0.25;
			this.isZoomed = true;
		}
	}

	public zoomOut() {
		if (this.zoomLevel > 0.5) {
			this.zoomLevel -= 0.25;
			this.isZoomed = this.zoomLevel !== 1;
		}
	}

	public resetZoom() {
		this.zoomLevel = 1;
		this.isZoomed = false;
	}

	public onImageLoad() {
		this.isLoading = false;
		this.showError = false;
	}

	public onImageError() {
		this.isLoading = false;
		this.showError = true;
	}
}
