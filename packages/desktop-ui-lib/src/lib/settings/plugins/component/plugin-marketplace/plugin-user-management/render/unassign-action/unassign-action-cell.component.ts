import { ChangeDetectionStrategy, Component, computed, EventEmitter, signal } from '@angular/core';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';

/** Row data expected by UnassignActionCellComponent */
export interface UnassignRowData {
	firstName?: string;
	lastName?: string;
	userId?: string;
	[key: string]: unknown;
}

@Component({
	selector: 'lib-unassign-action-cell',
	template: `
		<button
			nbButton
			ghost
			size="small"
			status="danger"
			[nbTooltip]="tooltipText()"
			[attr.aria-label]="tooltipText()"
			(click)="onClick($event)"
		>
			<nb-icon icon="person-remove-outline"></nb-icon>
		</button>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbIconModule, NbTooltipModule]
})
export class UnassignActionCellComponent {
	private readonly _rowData = signal<UnassignRowData | undefined>(undefined);
	public unassign = new EventEmitter<UnassignRowData>();

	set rowData(value: UnassignRowData) {
		this._rowData.set(value);
	}

	readonly userName = computed(() => {
		const data = this._rowData();
		const first = data?.firstName || '';
		const last = data?.lastName || '';
		return `${first} ${last}`.trim() || 'this user';
	});

	readonly tooltipText = computed(() =>
		`Remove ${this.userName()} from plugin entirely`
	);

	onClick(event: Event): void {
		event.stopPropagation();
		this.unassign.emit(this._rowData());
	}
}
