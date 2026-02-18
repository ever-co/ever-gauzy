import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IWorkspaceResponse } from '@gauzy/contracts';
import { NbCardModule, NbIconModule, NbListModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { DebounceClickDirective } from '../../../../directives/debounce-click.directive';
import { SpinnerButtonDirective } from '../../../../directives/spinner-button.directive';
import { AvatarComponent } from '../../../../shared/components/ui/avatar/avatar.component';
import { LogoComponent } from '../logo/logo.component';

@Component({
	selector: 'ngx-workspace-selection',
	templateUrl: './workspace-selection.component.html',
	styleUrls: ['./workspace-selection.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		LogoComponent,
		NbCardModule,
		NbListModule,
		DebounceClickDirective,
		AvatarComponent,
		SpinnerButtonDirective,
		NbIconModule,
		TranslatePipe
	]
})
export class WorkspaceSelectionComponent {
	selected: IWorkspaceResponse = null;
	/**
	 * Private property to store the workspaces.
	 */
	_workspaces: IWorkspaceResponse[] = [];
	/**
	 * The loading state of the workspace selection component.
	 * */
	@Input() loading = false;
	/**
	 * Getter for the workspaces property.
	 * @returns The value of the workspaces.
	 */
	get workspaces(): IWorkspaceResponse[] {
		return this._workspaces;
	}
	/**
	 * Setter for the workspaces property.
	 * @param workspaces - The value to set for the workspaces.
	 */
	@Input() set workspaces(workspaces: IWorkspaceResponse[]) {
		this._workspaces = workspaces;
	}

	/**
	 * Private property to store the confirmed email.
	 */
	private _confirmedEmail: string;
	/**
	 * Getter for the confirmed email property.
	 * @returns The value of the confirmed email.
	 */
	get confirmedEmail(): string {
		return this._confirmedEmail;
	}
	/**
	 * Setter for the confirmed email property.
	 * @param value - The value to set for the confirmed email.
	 */
	@Input() set confirmedEmail(value: string) {
		this._confirmedEmail = value;
	}

	/**
	 * An @Output property that emits a workspace value when an event occurs.
	 *
	 */
	@Output() selectedWorkspace: EventEmitter<IWorkspaceResponse> = new EventEmitter();

	/**
	 * Select a workspace.
	 *
	 * @param workspace - The workspace to select.
	 */
	selectWorkspace(workspace: IWorkspaceResponse) {
		if (!workspace) {
			return; // Exit if the no workspace
		}
		this.selected = workspace;
		this.selectedWorkspace.emit(workspace);
	}
}
