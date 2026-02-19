import { Component, OnInit, Input } from '@angular/core';
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

	/** Typed as any to accept TemplateRef from plugin packages that may resolve a different @angular/core instance. */
	@Input() buttonTemplate: any;
	/** Typed as any to accept TemplateRef from plugin packages that may resolve a different @angular/core instance. */
	@Input() buttonTemplateVisible: any;

	constructor() {}
	/**
	 * not implemented
	 */
	ngOnInit(): void {}
}
