import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ComponentEnum } from '../../@core/constants/layout.constants';

@Component({
	selector: 'ngx-gauzy-button-action',
	templateUrl: './gauzy-button-action.component.html',
	styleUrls: ['./gauzy-button-action.component.scss']
})
export class GauzyButtonActionComponent implements OnInit {
	// This inputs properties are bound to a DOM properties in the template
	@Input() icon: string; // This propriety is bound nebular icon name
	@Input() text: string; // This propriety is bound custom text in button
	@Input() isDisable: boolean = true; // This propriety is bound disability of button
	@Input() buttonTemplate: any; // This propriety is bound template of buttons
	@Input() componentName: ComponentEnum; // This propriety is bound a string name of component
	// This decorator that marks a class field as an output property and supplies configuration metadata
	@Output() addOnClick: EventEmitter<any> = new EventEmitter<any>(); // create new instance of event emitter
	/**
	 * Default constructor
	 */
	constructor() {}
	/**
	 * not implemented
	 */
	ngOnInit(): void {}
	/**
	 * Trigger an event on click
	 */
	onAdd() {
		this.addOnClick.emit();
	}
}
