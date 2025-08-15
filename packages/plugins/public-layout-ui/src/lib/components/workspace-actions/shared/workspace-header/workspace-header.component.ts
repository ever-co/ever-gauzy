import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

/**
 * Shared header component for workspace action pages.
 * Contains the logo and close button that appears in all workspace action templates.
 */
@Component({
	selector: 'ga-workspace-header',
	templateUrl: './workspace-header.component.html',
	styleUrls: ['./workspace-header.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceHeaderComponent {
	@Input() title: string;
	@Input() subtitle: string;
	@Input() showCloseButton = true;

	@Output() readonly close = new EventEmitter<void>();

	/**
	 * Handle close button click
	 */
	onClose(): void {
		this.close.emit();
	}
}
