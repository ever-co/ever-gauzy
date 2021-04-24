import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IOrganization, ITask } from '@gauzy/contracts';
import { map, tap } from 'rxjs/operators';
import { TasksService } from './tasks.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class TeamTasksStoreService {
	private _tasks$: BehaviorSubject<ITask[]> = new BehaviorSubject([]);
	public tasks$: Observable<ITask[]> = this._tasks$
		.asObservable()
		.pipe(map(this._mapToViewModel.bind(this)));

	private _selectedTask$: BehaviorSubject<ITask> = new BehaviorSubject(null);
	public selectedTask$: Observable<ITask> = this._selectedTask$.asObservable();

	get tasks(): ITask[] {
		return this._tasks$.getValue();
	}

	constructor(private _taskService: TasksService) {}

	fetchTasks(organization?: IOrganization, employeeId = '') {
		const findObj = {};
		if (organization) {
			const { id: organizationId, tenantId } = organization;
			findObj['organizationId'] = organizationId;
			findObj['tenantId'] = tenantId;
		}
		this._taskService
			.getTeamTasks(findObj, employeeId)
			.pipe(
				tap(({ items }) => this.loadAllTasks(items)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _mapToViewModel(tasks) {
		return tasks.map((task) => ({
			...task,
			projectName: task.project ? task.project.name : undefined,
			employees: task.members ? task.members : undefined,
			assignTo: this._getTeamNames(task),
			creator: task.creator
				? `${task.creator.firstName} ${task.creator.lastName}`
				: null
		}));
	}

	private _getTeamNames(task) {
		if (task.teams && Array.isArray(task.teams)) {
			return task.teams.map((team) => team.name);
		}
		return [];
	}

	loadAllTasks(tasks: ITask[]): void {
		this._tasks$.next(tasks);
	}

	createTask(task: ITask): void {
		this._taskService
			.createTask(task)
			.pipe(
				tap((createdTask) => {
					const tasks = [...this.tasks, createdTask];
					this._tasks$.next(tasks);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	editTask(task: ITask): void {
		this._taskService
			.editTask(task)
			.pipe(
				tap(() => {
					const tasks = [...this.tasks];
					const newState = tasks.map((t) =>
						t.id === task.id ? task : t
					);
					this._tasks$.next(newState);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	delete(id: string): void {
		this._taskService
			.deleteTask(id)
			.pipe(
				tap(() => {
					const tasks = [...this.tasks];
					const newState = tasks.filter((t) => t.id !== id);
					this._tasks$.next(newState);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectTask(task: ITask) {
		this._selectedTask$.next(task);
	}
}
