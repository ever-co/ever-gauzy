import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-merchant-layout-selector',
    template: `
		<div class="content">
			<router-outlet></router-outlet>
		</div>
	`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class MerchantComponent { }
