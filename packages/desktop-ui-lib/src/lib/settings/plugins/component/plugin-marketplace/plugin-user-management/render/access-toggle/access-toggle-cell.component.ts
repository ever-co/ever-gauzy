import { ChangeDetectionStrategy, Component, EventEmitter } from '@angular/core';
import { NbToggleModule, NbTooltipModule } from '@nebular/theme';

@Component({
	selector: 'lib-access-toggle-cell',
	template: `
		<div class="toggle-wrapper">
			<nb-toggle
				[checked]="isEnabled"
				(checkedChange)="onToggle($event)"
				[nbTooltip]="tooltipText"
			></nb-toggle>
		</div>
	`,
	styles: [`
		.toggle-wrapper {
			display: flex;
			align-items: center;
			justify-content: center;
		}
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbToggleModule, NbTooltipModule]
})
export class AccessToggleCellComponent {
	public rowData: any;
	public toggled = new EventEmitter<any>();

	get isEnabled(): boolean {
		return !!this.rowData?.isActive;
	}

	get userName(): string {
		const first = this.rowData?.firstName || '';
		const last = this.rowData?.lastName || '';
		return `${first} ${last}`.trim() || 'this user';
	}

	get tooltipText(): string {
		return this.isEnabled
			? `Disable access for ${this.userName}`
			: `Enable access for ${this.userName}`;
	}

	onToggle(checked: boolean): void {
		this.toggled.emit({ ...this.rowData, newState: checked });
	}
}
