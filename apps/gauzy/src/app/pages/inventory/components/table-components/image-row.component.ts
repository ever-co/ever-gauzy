import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { IProductCategoryTranslated } from '@gauzy/models';

@Component({
	template: `
		<div class="img-container">
			<img
				*ngIf="rowData.imageUrl"
				[src]="rowData.imageUrl"
				alt="feature img"
			/>

			<img
				*ngIf="!rowData.imageUrl"
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
	value: string | number;
	rowData: IProductCategoryTranslated;
}
