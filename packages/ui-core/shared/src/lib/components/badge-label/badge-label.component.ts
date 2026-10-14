import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { NbComponentStatus, NbComponentSize } from '@nebular/theme';

@Component({
    selector: 'ngx-badge-label',
    templateUrl: './badge-label.component.html',
    styles: [
        `
			:host {
				:is(nb-badge) {
					position: relative;
				}
			}
		`
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class BadgeLabelComponent {
	@Input() status: NbComponentStatus = 'primary';
	@Input() size: NbComponentSize = 'medium';
	@Input() text: string;
}
