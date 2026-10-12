import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-security-trust-html',
    templateUrl: './trust-html.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TrustHtmlLinkComponent {

	@Input() value: string;
	@Input() rowData: any;
}
