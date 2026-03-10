import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NbIconModule } from '@nebular/theme';

@Component({
	selector: 'lib-assignment-status-cell',
	template: `
		<span class="status-pill" [class.active]="isActive" [class.disabled]="!isActive">
			<nb-icon [icon]="isActive ? 'checkmark-circle-2-outline' : 'close-circle-outline'" class="status-icon"></nb-icon>
			<span class="status-text">{{ label }}</span>
		</span>
	`,
	styles: [`
		.status-pill {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.25rem 0.625rem;
			border-radius: 1rem;
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
	public rowData: any;

	get isActive(): boolean {
		return !!this.rowData?.isActive;
	}

	get status(): string {
		return this.isActive ? 'success' : 'danger';
	}

	get label(): string {
		return this.isActive ? 'Active' : 'Disabled';
	}
}
