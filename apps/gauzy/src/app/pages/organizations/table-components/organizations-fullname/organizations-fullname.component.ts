import { Component, Input } from '@angular/core';

@Component({
	selector: 'ngx-organizations-fullname',
	template: `
		<div style="display: flex; align-items: center;">
			<div class="image-container">
				<img [src]="rowData.imageUrl" />
			</div>
			<div class="d-block" style="margin-left:15px;">{{ value }}</div>
		</div>
	`,
	styles: [
		`
			.image-container {
				width: 70px;
				height: 63px;
				display: flex;
				justify-content: center;
			}

			img {
				height: 100%;
				max-width: 70px;
			}
		`
	]
})
export class OrganizationsFullnameComponent {
	@Input()
	rowData: any;

	value: string | number;
}
