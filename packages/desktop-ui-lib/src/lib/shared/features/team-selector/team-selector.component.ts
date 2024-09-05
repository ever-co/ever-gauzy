import { Component } from '@angular/core';
import { IOrganizationTeam } from 'packages/contracts/dist';
import { Observable } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { TeamSelectorQuery } from './+state/team-selector.query';
import { TeamSelectorStore } from './+state/team-selector.store';

@Component({
	selector: 'gauzy-team-selector',
	templateUrl: './team-selector.component.html',
	styleUrls: ['./team-selector.component.scss']
})
export class TeamSelectorComponent {
	constructor(
		private readonly electronService: ElectronService,
		private readonly teamSelectorStore: TeamSelectorStore,
		private readonly teamSelectorQuery: TeamSelectorQuery
	) {}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public get error$(): Observable<string> {
		return this.teamSelectorQuery.selectError();
	}

	public get selectedId$(): Observable<string> {
		return this.teamSelectorQuery.selectedId$;
	}

	public get data$(): Observable<IOrganizationTeam[]> {
		return this.teamSelectorQuery.data$;
	}

	public change(teamId: IOrganizationTeam['id']) {
		this.teamSelectorStore.updateSelected(teamId);
	}
}
