import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { IOrganizationProject, resolveGithubSyncLabel } from '@gauzy/contracts';
import { GithubProjectSyncModeEnum, getGithubProjectSyncMode } from '../../github-project-sync';

/**
 * A cell of the GitHub page's synced projects table: how the project syncs the repository's issues (off, every
 * issue, or only those with its sync label) and a button that opens the project's sync settings (#7083).
 */
@Component({
	selector: 'ngx-github-project-sync-label',
	imports: [TranslatePipe, NbButtonModule, NbIconModule],
	templateUrl: './project-sync-label.component.html',
	styleUrls: ['./project-sync-label.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class GithubProjectSyncLabelComponent {
	public readonly syncModeEnum = GithubProjectSyncModeEnum;

	/** The table row: the project mapped to the repository. */
	@Input() rowData: IOrganizationProject;

	/** The cell value (unused: everything is read from the row). */
	@Input() value: unknown;

	/** Emits the project when its sync settings should be edited. */
	@Output() edit = new EventEmitter<IOrganizationProject>();

	/** How the project syncs the issues GitHub sends. */
	get syncMode(): GithubProjectSyncModeEnum {
		return getGithubProjectSyncMode(this.rowData);
	}

	/** The label the project syncs on: its own, or the default one. */
	get syncLabel(): string {
		return resolveGithubSyncLabel(this.rowData?.syncTag);
	}

	/**
	 * Asks for the project's sync settings, without selecting the table row.
	 *
	 * @param event - The click on the edit button.
	 */
	public onEdit(event: MouseEvent): void {
		event.stopPropagation();
		this.edit.emit(this.rowData);
	}
}
