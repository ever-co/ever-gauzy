import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ProductType } from '@gauzy/models';

@Component({
	template: `
		<div>
			<img [src]="rowData.organization.imageUrl" alt="organization img" />
			<span>{{ rowData.organization.name }}</span>
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
export class OrganizationRowComponent implements ViewCell {
	@Input()
	value: string | number;
	rowData: ProductType;
}
