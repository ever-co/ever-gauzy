import { ChangeDetectionStrategy, Component, EventEmitter } from '@angular/core';
import { NbToggleModule, NbTooltipModule } from '@nebular/theme';

@Component({
	selector: 'lib-access-toggle-cell',
	template: `
		<nb-toggle
			[checked]="isEnabled"
			(checkedChange)="onToggle($event)"
			[nbTooltip]="isEnabled ? 'Click to disable access' : 'Click to enable access'"
		></nb-toggle>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbToggleModule, NbTooltipModule]
})
export class AccessToggleCellComponent {
	public rowData: any;
	public toggled = new EventEmitter<any>();

	get isEnabled(): boolean {
		return !!this.rowData?.isActive;
	}

	onToggle(checked: boolean): void {
		this.toggled.emit({ ...this.rowData, newState: checked });
	}
}
