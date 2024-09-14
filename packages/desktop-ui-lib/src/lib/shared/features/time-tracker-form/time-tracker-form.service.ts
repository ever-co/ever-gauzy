import { Injectable } from '@angular/core';
import { ClientSelectorService } from '../client-selector/+state/client-selector.service';
import { NoteService } from '../note/+state/note.service';
import { ProjectSelectorService } from '../project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../team-selector/+state/team-selector.service';

export interface ITimeTrackerFormState {
	clientId: string;
	projectId: string;
	teamId: string;
	taskId: string;
	note: string;
}

@Injectable({
	providedIn: 'root'
})
export class TimeTrackerFormService {
	constructor(
		private readonly clientSelectorService: ClientSelectorService,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly teamSelectorService: TeamSelectorService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly noteService: NoteService
	) {}

	// Get the current state from all selector services
	public getState(): ITimeTrackerFormState {
		return {
			clientId: this.clientSelectorService.selectedId ?? '',
			projectId: this.projectSelectorService.selectedId ?? '',
			teamId: this.teamSelectorService.selectedId ?? '',
			taskId: this.taskSelectorService.selectedId ?? '',
			note: this.noteService.note ?? ''
		};
	}

	public setState(state: Partial<ITimeTrackerFormState>): void {
		this.updateState(this.noteService, 'note', state.note);
		this.updateState(this.taskSelectorService, 'selected', state.taskId);
		this.updateState(this.projectSelectorService, 'selected', state.projectId);
		this.updateState(this.teamSelectorService, 'selected', state.teamId);
		this.updateState(this.clientSelectorService, 'selected', state.clientId);
	}

	private updateState(service: any, key: string, newValue: any): void {
		if (newValue !== undefined && service[key] !== newValue) {
			service[key] = newValue;
		}
	}
}
