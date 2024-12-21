import { Component } from '@angular/core';

@Component({
    selector: 'ga-warehouse-layout-selector',
    template: `
		<div class="content">
			<router-outlet></router-outlet>
		</div>
	`,
    standalone: false
})
export class WarehousesComponent { }
