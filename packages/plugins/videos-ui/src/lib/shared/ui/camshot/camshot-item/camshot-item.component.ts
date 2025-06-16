import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CamshotQuery } from '../../../../+state/camshot/camshot.query';
import { ActionButton, IActionButton } from '../../../models/action-button.model';
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

	constructor(private readonly query: CamshotQuery) {}

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
			new ActionButton({
				label: 'BUTTONS.VIEW',
				icon: 'eye-outline',
				status: 'basic',
				action: (camshot: ICamshot) => this.view.emit(camshot)
			}),
			new ActionButton({
				icon: 'download-outline',
				label: 'BUTTONS.DOWNLOAD',
				loading: this.query.downloading$,
				status: 'info',
				action: (camshot: ICamshot) => this.download.emit(camshot)
			})
		];

		const statusSpecificActions: IActionButton[] = this.camshot.isDeleted
			? [
					new ActionButton({
						icon: 'refresh-outline',
						label: 'BUTTONS.RECOVER',
						status: 'success',
						loading: this.query.restoring$,
						action: (camshot: ICamshot) => this.recover.emit(camshot)
					}),
					new ActionButton({
						icon: 'trash-2-outline',
						label: 'Hard Delete',
						status: 'danger',
						loading: this.query.deleting$,
						action: (camshot: ICamshot) => this.hardDelete.emit(camshot)
					})
			  ]
			: [
					new ActionButton({
						icon: 'trash-outline',
						label: 'BUTTONS.DELETE',
						loading: this.query.deleting$,
						status: 'danger',
						action: (camshot: ICamshot) => this.delete.emit(camshot)
					})
			  ];

		this.buttons = [...commonActions, ...statusSpecificActions];
	}
}
