import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ProductType } from '@gauzy/models';

@Component({
	template: `
		<div class="icon-container">
			<nb-icon *ngIf="rowData.icon" [icon]="rowData.icon"></nb-icon>
		</div>
	`,
	styles: [
		`
			.icon-container {
				width: 35px;
				height: 35px;
				display: flex;
				justify-content: center;
				align-items: center;
				background: #3366ff;
				padding: 5px 0;
				border-radius: 50%;
			}

			nb-icon {
				color: #fff;
				width: 25px;
			}
		`,
	],
})
export class IconRowComponent implements ViewCell {
	@Input()
	value: string | number;
	rowData: ProductType;
}
