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
				action: (camshot: ICamshot) => this.view.emit(camshot)
			},
			{
				icon: 'download-outline',
				label: 'BUTTONS.DOWNLOAD',
				status: 'info',
				hidden: false,
				disabled: false,
				action: (camshot: ICamshot) => this.download.emit(camshot)
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
						action: (camshot: ICamshot) => this.recover.emit(camshot)
					},
					{
						icon: 'trash-2-outline',
						label: 'Hard Delete',
						status: 'danger',
						hidden: false,
						disabled: false,
						action: (camshot: ICamshot) => this.hardDelete.emit(camshot)
					}
			  ]
			: [
					{
						icon: 'trash-outline',
						label: 'BUTTONS.DELETE',
						status: 'warning',
						hidden: false,
						disabled: false,
						action: (camshot: ICamshot) => this.delete.emit(camshot)
					}
			  ];

		this.buttons = [...commonActions, ...statusSpecificActions];
	}
}
