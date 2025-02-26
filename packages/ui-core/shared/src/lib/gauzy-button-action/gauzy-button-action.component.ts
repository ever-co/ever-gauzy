import { Component, OnInit, Input, TemplateRef } from '@angular/core';
import { ComponentEnum } from '@gauzy/ui-core/common';

@Component({
    selector: 'ngx-gauzy-button-action',
    templateUrl: './gauzy-button-action.component.html',
    styleUrls: ['./gauzy-button-action.component.scss'],
    standalone: false
})
export class GauzyButtonActionComponent implements OnInit {
	@Input() isDisable: boolean = true;
	@Input() hasLayoutSelector: boolean = true;
	@Input() componentName: ComponentEnum;

	@Input() buttonTemplate: TemplateRef<HTMLElement>;
	@Input() buttonTemplateVisible: TemplateRef<HTMLElement>;

	constructor() {}
	/**
	 * not implemented
	 */
	ngOnInit(): void {}
}
