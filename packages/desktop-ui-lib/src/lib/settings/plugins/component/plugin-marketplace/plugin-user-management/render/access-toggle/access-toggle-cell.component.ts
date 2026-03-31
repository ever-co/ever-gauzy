import { ChangeDetectionStrategy, Component, computed, EventEmitter, signal } from '@angular/core';
import { NbToggleModule, NbTooltipModule } from '@nebular/theme';

/** Row data expected by AccessToggleCellComponent */
export interface AccessToggleRow {
	isActive?: boolean;
	firstName?: string;
	lastName?: string;
	userId?: string;
	[key: string]: unknown;
}

@Component({
	selector: 'lib-access-toggle-cell',
	template: `
		<div class="toggle-wrapper">
			<nb-toggle
				[checked]="isEnabled()"
				(checkedChange)="onToggle($event)"
				[nbTooltip]="tooltipText()"
				[attr.aria-label]="tooltipText()"
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
	private readonly _rowData = signal<AccessToggleRow | undefined>(undefined);
	public toggled = new EventEmitter<AccessToggleRow & { newState: boolean }>();

	set rowData(value: AccessToggleRow) {
		this._rowData.set(value);
	}

	readonly isEnabled = computed(() => !!this._rowData()?.isActive);

	readonly userName = computed(() => {
		const data = this._rowData();
		const first = data?.firstName || '';
		const last = data?.lastName || '';
		return `${first} ${last}`.trim() || 'this user';
	});

	readonly tooltipText = computed(() =>
		this.isEnabled()
			? `Disable access for ${this.userName()}`
			: `Enable access for ${this.userName()}`
	);

	onToggle(checked: boolean): void {
		this.toggled.emit({ ...this._rowData(), newState: checked });
	}
}
