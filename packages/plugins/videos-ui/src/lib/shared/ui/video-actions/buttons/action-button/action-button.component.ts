import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IActionButton } from '../../../../../shared/models/action-button.model';

@Component({
	selector: 'plug-action-button',
	templateUrl: './action-button.component.html',
	styleUrl: './action-button.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionButtonComponent {
	@Input({ required: true }) button!: IActionButton;
	@Input() data!: any;

	public async triggerAction(): Promise<void> {
		if (!this.button.action) {
			return;
		}
		await this.button.action(this.data);
	}
}
