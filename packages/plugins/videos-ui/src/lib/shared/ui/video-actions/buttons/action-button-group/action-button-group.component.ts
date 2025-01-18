import { Component, Input } from '@angular/core';
import { IActionButton } from '../../../../../shared/models/action-button.model';

@Component({
	selector: 'plug-action-button-group',
	templateUrl: './action-button-group.component.html',
	styleUrl: './action-button-group.component.scss'
})
export class ActionButtonGroupComponent {
	@Input() buttons: IActionButton[] = [];
	@Input() data: any;
}
