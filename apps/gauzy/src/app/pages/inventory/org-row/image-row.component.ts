import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ProductType, ProductCategory } from '@gauzy/models';

@Component({
	template: `
		<div>
			<img [src]="rowData.imageUrl" alt="feature img" />
		</div>
	`,
	styles: [
		`
			img {
				width: 50px;
				margin-right: 15px;
				border-radius: 5px;
			}
		`
	]
})
export class ImageRowComponent implements ViewCell {
	@Input()
	value: string | number;
	rowData: ProductType | ProductCategory;
}
