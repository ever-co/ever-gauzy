import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Camshot, ICamshot } from '../../../models/camshot.model';
import { IActionButton } from '../../../models/action-button.model';

@Component({
	selector: 'plug-camshot-item',
	templateUrl: './camshot-item.component.html',
	styleUrl: './camshot-item.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CamshotItemComponent {
	private _camshot: ICamshot;

	@Input()
	public actions: IActionButton[] = [];

	@Input()
	public set camshot(value: ICamshot) {
		this._camshot = new Camshot(value);
	}

	public get camshot(): ICamshot {
		return this._camshot;
	}
}
