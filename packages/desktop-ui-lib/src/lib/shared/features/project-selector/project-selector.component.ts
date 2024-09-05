import { Component } from '@angular/core';
import { IOrganizationProject } from 'packages/contracts/dist';
import { Observable } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { ProjectSelectorQuery } from './+state/project-selector.query';
import { ProjectSelectorService } from './+state/project-selector.service';
import { ProjectSelectorStore } from './+state/project-selector.store';

@Component({
	selector: 'gauzy-project-selector',
	templateUrl: './project-selector.component.html',
	styleUrls: ['./project-selector.component.scss']
})
export class ProjectSelectorComponent {
	constructor(
		private readonly electronService: ElectronService,
		public readonly projectSelectorStore: ProjectSelectorStore,
		public readonly projectSelectorQuery: ProjectSelectorQuery,
		private readonly projectSelectorService: ProjectSelectorService
	) {}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public addProject = async (name: IOrganizationProject['name']) => {
		return this.projectSelectorService.addProject(name);
	};

	public get error$(): Observable<string> {
		return this.projectSelectorQuery.selectError();
	}

	public get selectedId$(): Observable<string> {
		return this.projectSelectorQuery.selectedId$;
	}

	public get data$(): Observable<IOrganizationProject[]> {
		return this.projectSelectorQuery.data$;
	}

	public change(projectId: IOrganizationProject['id']) {
		this.projectSelectorStore.updateSelected(projectId);
	}

	public isLoading$(): Observable<boolean> {
		return this.projectSelectorQuery.selectLoading();
	}
}
