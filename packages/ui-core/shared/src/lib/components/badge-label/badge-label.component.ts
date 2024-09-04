import { Component, Input } from '@angular/core';
import { NbComponentStatus, NbComponentSize } from '@nebular/theme';

@Component({
	selector: 'ngx-badge-label',
	templateUrl: './badge-label.component.html',
	styles: [
		`
			:host {
				nb-badge {
					position: relative;
				}
			}
		`
	]
})
export class BadgeLabelComponent {
	@Input() status: NbComponentStatus = 'primary';
	@Input() size: NbComponentSize = 'medium';
	@Input() text: string;
}
