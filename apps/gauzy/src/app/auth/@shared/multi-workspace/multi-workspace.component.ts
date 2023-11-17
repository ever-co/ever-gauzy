import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IWorkspaceResponse } from '@gauzy/contracts';
import { TranslationBaseComponent } from './../../../@shared/language-base';

@Component({
	selector: 'ngx-multi-workspace-onboarding',
	templateUrl: './multi-workspace.component.html',
	styleUrls: ['./multi-workspace.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiWorkspaceOnboardingComponent extends TranslationBaseComponent implements OnInit {

	/**
	 * Private property to store the workspaces.
	 */
	_workspaces: IWorkspaceResponse[] = [];
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
	_confirmed_email: string;
	/**
	 * Getter for the confirmed email property.
	 * @returns The value of the confirmed email.
	 */
	get confirmed_email(): string {
		return this._confirmed_email;
	}
	/**
	 * Setter for the confirmed email property.
	 * @param value - The value to set for the confirmed email.
	 */
	@Input() set confirmed_email(value: string) {
		this._confirmed_email = value;
	}

	/**
	 * An @Output property that emits a workspace value when an event occurs.
	 *
	 */
	@Output() selectedWorkspace: EventEmitter<IWorkspaceResponse> = new EventEmitter();

	constructor(
		public readonly translateService: TranslateService,
	) {
		super(translateService);
	}

	ngOnInit() { }

	/**
	 *
	 * @param workspace
	 * @returns
	 */
	selectWorkspace(workspace: IWorkspaceResponse) {
		if (!workspace) {
			return; // Exit if the no workspace
		}
		this.selectedWorkspace.emit(workspace);
	}
}
