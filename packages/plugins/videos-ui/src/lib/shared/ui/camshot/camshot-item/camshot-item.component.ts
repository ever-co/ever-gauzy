import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IActionButton } from '../../../models/action-button.model';
import { Camshot, ICamshot } from '../../../models/camshot.model';

@Component({
	selector: 'plug-camshot-item',
	templateUrl: './camshot-item.component.html',
	styleUrls: ['./camshot-item.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CamshotItemComponent {
	private _camshot: Camshot;

	@Input()
	public set camshot(value: ICamshot) {
		this._camshot = new Camshot(value);
		this.updateActions();
	}

	public get camshot(): Camshot {
		return this._camshot;
	}

	@Output() view = new EventEmitter<ICamshot>();
	@Output() download = new EventEmitter<ICamshot>();
	@Output() recover = new EventEmitter<ICamshot>();
	@Output() delete = new EventEmitter<ICamshot>();
	@Output() hardDelete = new EventEmitter<ICamshot>();

	public buttons: IActionButton[] = [];

	private updateActions(): void {
		const commonActions: IActionButton[] = [
			{
				label: 'BUTTONS.VIEW',
				icon: 'eye-outline',
				status: 'basic',
				hidden: false,
				disabled: false,
				action: this.download.emit.bind(this)
			},
			{
				icon: 'download-outline',
				label: 'BUTTONS.DOWNLOAD',
				status: 'info',
				hidden: false,
				disabled: false,
				action: this.download.emit.bind(this)
			}
		];

		const statusSpecificActions: IActionButton[] = this.camshot.isDeleted
			? [
					{
						icon: 'undo-outline',
						label: 'BUTTONS.RECOVER',
						status: 'success',
						hidden: false,
						disabled: false,
						action: this.recover.emit.bind(this)
					},
					{
						icon: 'trash-2-outline',
						label: 'Hard Delete',
						status: 'danger',
						hidden: false,
						disabled: false,
						action: this.hardDelete.emit.bind(this)
					}
			  ]
			: [
					{
						icon: 'trash-outline',
						label: 'BUTTONS.DELETE',
						status: 'warning',
						hidden: false,
						disabled: false,
						action: this.delete.emit.bind(this)
					}
			  ];

		this.buttons = [...commonActions, ...statusSpecificActions];
	}
}
