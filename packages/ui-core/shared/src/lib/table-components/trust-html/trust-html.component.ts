import { Component, Input } from '@angular/core';

@Component({
    selector: 'ngx-security-trust-html',
    templateUrl: './trust-html.component.html',
    standalone: false
})
export class TrustHtmlLinkComponent {

	@Input() value: string;
	@Input() rowData: any;
}
