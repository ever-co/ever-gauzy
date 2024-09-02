import { Component, Input } from '@angular/core';
import { NbComponentStatus, NbComponentSize } from '@nebular/theme';

@Component({
	selector: 'ngx-badge-label',
	templateUrl: './badge-label.component.html',
	styles: [
		`
			:host {
				display: inline-block;
				position: relative;
				nb-badge {
					right: inherit !important;
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
