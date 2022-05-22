import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { DEFAULT_SVG } from './../../../../@core/constants';

@Component({
	template: `
		<div class="img-container">
			<img *ngIf="imageUrl" [src]="imageUrl" alt="feature img" />
			<img
				*ngIf="!imageUrl"
				[src]="fallbackSvg"
				[alt]="'Product Item Photo'"
				class="variant-table-img"
			/>
		</div>
	`,
	styles: [
		`
			.img-container {
				width: 100%;
				display: flex;
				justify-content: flex-start;
			}
			img {
				width: 74px;
				height: 64px;
				object-fit: cover;
				border-radius: 8px;
			}

			.variant-table-img {
				border-radius: 50%;
			}
		`
	]
})
export class ImageRowComponent implements ViewCell {
	@Input()
	value: any;
	rowData: any;

	fallbackSvg = DEFAULT_SVG;

	get imageUrl() {
		if (typeof this.value == 'string') return this.value;

		if (!this.value) return false;

		if (this.value.imageUrl) return this.value.imageUrl;

		if (this.value.url) return this.value.url;
	}
}
