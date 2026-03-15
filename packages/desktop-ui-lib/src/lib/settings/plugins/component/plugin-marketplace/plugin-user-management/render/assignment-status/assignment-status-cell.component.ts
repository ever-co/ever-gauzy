import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NbIconModule } from '@nebular/theme';

/** Row data expected by AssignmentStatusCellComponent */
export interface AssignmentStatusRow {
	isActive?: boolean;
	[key: string]: unknown;
}

@Component({
	selector: 'lib-assignment-status-cell',
	template: `
		<span
			class="status-pill"
			[class.active]="isActive()"
			[class.disabled]="!isActive()"
			role="status"
			aria-live="polite"
			[attr.aria-label]="label() + (isActive() ? ' active' : ' inactive')"
			[attr.aria-disabled]="!isActive()"
		>
			<nb-icon
				[icon]="isActive() ? 'checkmark-circle-2-outline' : 'close-circle-outline'"
				class="status-icon"
				aria-hidden="true"
			></nb-icon>
			<span class="status-text">{{ label() }}</span>
		</span>
	`,
	styles: [`
		.status-pill {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.25rem 0.625rem;
			border-radius: calc(var(--border-radius) * 2);
			font-size: 0.75rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
			line-height: 1;
			transition: all 0.2s ease;
		}
		.status-pill.active {
			background: rgba(0, 200, 83, 0.12);
			color: var(--color-success-default, #00c853);
		}
		.status-pill.disabled {
			background: rgba(255, 61, 113, 0.12);
			color: var(--color-danger-default, #ff3d71);
		}
		.status-icon {
			font-size: 0.875rem;
		}
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule]
})
export class AssignmentStatusCellComponent {
	private readonly _rowData = signal<AssignmentStatusRow | undefined>(undefined);

	set rowData(value: AssignmentStatusRow) {
		this._rowData.set(value);
	}

	readonly isActive = computed(() => !!this._rowData()?.isActive);

	readonly status = computed(() => this.isActive() ? 'success' : 'danger');

	readonly label = computed(() => this.isActive() ? 'Active' : 'Disabled');
}
