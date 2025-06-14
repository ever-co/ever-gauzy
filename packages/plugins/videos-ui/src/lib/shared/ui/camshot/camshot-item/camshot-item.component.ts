import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IActionButton } from '../../../models/action-button.model';
import { Camshot, ICamshot } from '../../../models/camshot.model';
import { ID } from '@gauzy/contracts';

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

	@Output() view = new EventEmitter<ID>();
	@Output() download = new EventEmitter<ID>();
	@Output() recover = new EventEmitter<ID>();
	@Output() delete = new EventEmitter<ID>();
	@Output() hardDelete = new EventEmitter<ID>();

	public actions: IActionButton[] = [];

	private updateActions(): void {
		const commonActions: IActionButton[] = [
			{
				icon: 'eye-outline',
				label: 'View',
				status: 'primary',
				action: () => this.view.emit(this.camshot.id)
			},
			{
				icon: 'download-outline',
				label: 'Download',
				status: 'info',
				action: () => this.download.emit(this.camshot.id)
			}
		];

		const statusSpecificActions: IActionButton[] = this.camshot.isDeleted
			? [
					{
						icon: 'undo-outline',
						label: 'Recover',
						status: 'success',
						action: () => this.recover.emit(this.camshot.id)
					},
					{
						icon: 'trash-2-outline',
						label: 'Hard Delete',
						status: 'danger',
						action: () => this.hardDelete.emit(this.camshot.id)
					}
			  ]
			: [
					{
						icon: 'trash-outline',
						label: 'Delete',
						status: 'warning',
						action: () => this.delete.emit(this.camshot.id)
					}
			  ];

		this.actions = [...commonActions, ...statusSpecificActions];
	}
}
