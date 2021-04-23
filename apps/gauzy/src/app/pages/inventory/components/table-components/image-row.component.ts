import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	template: `
		<div class="img-container">
			<img *ngIf="imageUrl" [src]="imageUrl" alt="feature img" />

			<img
				*ngIf="!imageUrl"
				[src]="'https://afostats.imagead.net/uploads/afo/no_img.png'"
				alt="Product Item Photo"
				class="variant-table-img"
			/>
		</div>
	`,
	styles: [
		`
			.img-container {
				width: 100%;
				display: flex;
				justify-content: center;
			}
			img {
				width: 50px;
				border-radius: 5px;
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

	get imageUrl() {
		if (typeof this.value == 'string') return this.value;

		if (!this.value) return false;

		if (this.value.imageUrl) return this.value.imageUrl;

		if (this.value.url) return this.value.url;
	}
}
