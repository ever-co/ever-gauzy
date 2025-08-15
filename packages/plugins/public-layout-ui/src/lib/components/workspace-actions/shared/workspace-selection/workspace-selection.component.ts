import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { IWorkspaceResponse } from '@gauzy/contracts';

/**
 * Shared workspace selection component.
 * Used by workspace-signin and workspace-find components to display available workspaces.
 */
@Component({
	selector: 'ga-workspace-selection',
	templateUrl: './workspace-selection.component.html',
	styleUrls: ['./workspace-selection.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceSelectionComponent {
	@Input() workspaces: IWorkspaceResponse[] = [];
	@Input() confirmedEmail: string;
	@Input() totalWorkspaces = 0;
	@Input() showCreateButton = false;
	@Input() welcomeTitle = 'WORKSPACES.SELECTION.WELCOME_BACK';
	@Input() descriptionText = 'WORKSPACES.FIND.RESULTS_STEP.DESCRIPTION';
	@Input() selectWorkspaceText = 'WORKSPACES.SELECTION.SELECT_WORKSPACE_FOR';
	@Input() createButtonText = 'WORKSPACES.CREATE.CREATE_NEW_WORKSPACE';

	@Output() readonly workspaceSelected = new EventEmitter<IWorkspaceResponse>();
	@Output() readonly createWorkspace = new EventEmitter<void>();

	/**
	 * Handle workspace selection
	 */
	onWorkspaceSelect(workspace: IWorkspaceResponse): void {
		this.workspaceSelected.emit(workspace);
	}

	/**
	 * Handle create new workspace button click
	 */
	onCreateWorkspace(): void {
		this.createWorkspace.emit();
	}

	setDefaultLogo(event: Event) {
		const el = event.target as HTMLImageElement;
		if (el && el.src !== '/assets/images/logos/logo_Gauzy.png') {
			el.src = '/assets/images/logos/logo_Gauzy.png';
		}
	}
	/**
	 * Track by function for workspace lists
	 */
	trackByWorkspaceId = (_: number, w: IWorkspaceResponse) => w?.user?.tenant?.id || w?.user?.id;
}
