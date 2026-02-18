import { Component, Input } from '@angular/core';
import { Nl2BrPipe } from '../../pipes/nl2br.pipe';

@Component({
	selector: 'ngx-security-trust-html',
	templateUrl: './trust-html.component.html',
	standalone: true,
	imports: [Nl2BrPipe]
})
export class TrustHtmlLinkComponent {
	@Input() value: string;
	@Input() rowData: any;
}
