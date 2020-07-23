import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ProductCategoryTranslated } from '@gauzy/models';

@Component({
	template: `
		<div class="img-container">
			<img
				*ngIf="rowData.imageUrl"
				[src]="rowData.imageUrl"
				alt="feature img"
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
		`
	]
})
export class ImageRowComponent implements ViewCell {
	@Input()
	value: string | number;
	rowData: ProductCategoryTranslated;
}
