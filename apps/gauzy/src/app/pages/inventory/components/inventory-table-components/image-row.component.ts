import { Component, Input } from '@angular/core';
import { DEFAULT_SVG } from '@gauzy/ui-core/common';

@Component({
    template: `
		<div class="img-container">
			<img *ngIf="imageUrl" [src]="imageUrl" alt="feature img" />
			<ga-no-image class="no-image" *ngIf="!imageUrl"></ga-no-image>
		</div>
	`,
    styles: [
        `
			.img-container {
				width: 74px;
				display: flex;
				justify-content: flex-start;
			}
			img {
				width: 74px;
				height: 60px;
				object-fit: cover;
				border-radius: 4px;
			}

			.variant-table-img {
				border-radius: 50%;
			}
			.no-image {
				width: 100%;
				height: 60px;
			}
		`
    ],
    standalone: false
})
export class ImageRowComponent {
	@Input()
	value: any;
	rowData: any;

	fallbackSvg = DEFAULT_SVG;

	get imageUrl() {
		if (!this.rowData && !this.value) {
			return null;
		}
		if (this.rowData.image?.fullUrl) {
			return this.rowData.image?.fullUrl;
		}
		if (this.rowData.featuredImage && this.rowData.featuredImage?.fullUrl) {
			return this.rowData.featuredImage?.fullUrl;
		}
		if (this.rowData.featuredImage && this.rowData.featuredImage.url) {
			return this.rowData.featuredImage.url;
		}
		if (this.rowData.image?.url) {
			return this.rowData.image?.url;
		}

		if (!this.value) return false;

		if (this.value?.fullUrl) return this.value?.fullUrl;

		if (this.value?.url) return this.value?.url;

		if (typeof this.value == 'string') return this.value;
	}
}
