import { Component, OnInit } from '@angular/core';
import { IOrganizationContact } from 'packages/contracts/dist';
import { concatMap, filter, Observable, tap } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { ProjectSelectorService } from '../project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../team-selector/+state/team-selector.service';
import { ClientSelectorQuery } from './+state/client-selector.query';
import { ClientSelectorService } from './+state/client-selector.service';
import { ClientSelectorStore } from './+state/client-selector.store';

@Component({
	selector: 'gauzy-client-selector',
	templateUrl: './client-selector.component.html',
	styleUrls: ['./client-selector.component.scss']
})
export class ClientSelectorComponent implements OnInit {
	constructor(
		private readonly electronService: ElectronService,
		public readonly clientSelectorStore: ClientSelectorStore,
		public readonly clientSelectorQuery: ClientSelectorQuery,
		private readonly clientSelectorService: ClientSelectorService,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly teamSelectorService: TeamSelectorService
	) {}

	public ngOnInit(): void {
		this.clientSelectorService
			.getAll$()
			.pipe(
				filter((data) => !data.some((value) => value.id === this.clientSelectorService.selectedId)),
				tap(() => (this.clientSelectorService.selected = null))
			)
			.subscribe();
		this.clientSelectorQuery.selected$
			.pipe(
				filter((client) => !!client),
				concatMap(() => this.projectSelectorService.load()),
				concatMap(() => this.taskSelectorService.load()),
				concatMap(() => this.teamSelectorService.load())
			)
			.subscribe();
	}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public addContact = async (name: IOrganizationContact['name']) => {
		return this.clientSelectorService.addContact(name);
	};

	public get error$(): Observable<string> {
		return this.clientSelectorQuery.selectError();
	}

	public get selectedId$(): Observable<string> {
		return this.clientSelectorQuery.selectedId$;
	}

	public get data$(): Observable<IOrganizationContact[]> {
		return this.clientSelectorQuery.data$;
	}

	public change(clientId: IOrganizationContact['id']) {
		this.clientSelectorStore.updateSelected(clientId);
	}

	public isLoading$(): Observable<boolean> {
		return this.clientSelectorQuery.selectLoading();
	}
}
