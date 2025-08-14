import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IWorkspaceResponse } from '@gauzy/contracts';

/**
 * Shared workspace selection component.
 * Used by workspace-signin and workspace-find components to display available workspaces.
 */
@Component({
	selector: 'ga-workspace-selection',
	templateUrl: './workspace-selection.component.html',
	styleUrls: ['./workspace-selection.component.scss'],
	standalone: false
})
export class WorkspaceSelectionComponent {
	@Input() workspaces: IWorkspaceResponse[] = [];
	@Input() confirmedEmail: string;
	@Input() totalWorkspaces: number = 0;
	@Input() showCreateButton: boolean = false;
	@Input() welcomeTitle: string = 'WORKSPACES.SELECTION.WELCOME_BACK';
	@Input() descriptionText: string = 'WORKSPACES.FIND.RESULTS_STEP.DESCRIPTION';
	@Input() selectWorkspaceText: string = 'WORKSPACES.SELECTION.SELECT_WORKSPACE_FOR';
	@Input() createButtonText: string = 'WORKSPACES.CREATE.CREATE_NEW_WORKSPACE';

	@Output() workspaceSelected = new EventEmitter<IWorkspaceResponse>();
	@Output() createWorkspace = new EventEmitter<void>();

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

	/**
	 * Track by function for workspace lists
	 */
	trackByWorkspaceId = (_: number, w: any) => w?.user?.tenant?.id || w?.user?.id || w?.id;
}
