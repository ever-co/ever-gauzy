import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { IOrganizationProject } from '@gauzy/contracts';
import { DEFAULT_SVG } from '@gauzy/ui-core/common';

@Component({
    selector: 'ga-project-column-view',
    templateUrl: './project-column-view.component.html',
    styleUrls: ['./project-column-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ProjectColumnViewComponent {
	fallbackSvg = DEFAULT_SVG;

	@Input() project: IOrganizationProject;

	constructor() {}
}
