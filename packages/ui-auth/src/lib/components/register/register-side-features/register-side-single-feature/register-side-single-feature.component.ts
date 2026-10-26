import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { IChangelog } from "@gauzy/contracts";

@Component({
    selector: 'ngx-register-side-single-feature',
    templateUrl: './register-side-single-feature.component.html',
    styleUrls: ['./register-side-single-feature.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class NgxRegisterSideSingleFeatureComponent {
	@Input() feature: IChangelog | null = null;
	
	constructor () {}
}
