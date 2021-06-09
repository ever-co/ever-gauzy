import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ITask, ITaskResponse } from '@gauzy/contracts';
import { map, tap } from 'rxjs/operators';
import { TasksService } from './tasks.service';

@Injectable({
	providedIn: 'root'
})
export class TeamTasksStoreService {
	private _tasks$: BehaviorSubject<ITask[]> = new BehaviorSubject([]);
	public tasks$: Observable<ITask[]> = this._tasks$.asObservable().pipe(map(this._mapToViewModel.bind(this)));

	private _selectedTask$: BehaviorSubject<ITask> = new BehaviorSubject(null);
	public selectedTask$: Observable<ITask> = this._selectedTask$.asObservable();

	get tasks(): ITask[] {
		return this._tasks$.getValue();
	}

	constructor(
		private readonly _taskService: TasksService
	) {}

	fetchTasks(
		tenantId: string,
		organizationId: string,
		employeeId: string = ''
	): Observable<ITaskResponse> {
		return this._taskService
			.getTeamTasks({
				tenantId,
				organizationId
			}, employeeId)
			.pipe(
				tap(({ items }) => this.loadAllTasks(items))
			);
	}

	private _mapToViewModel(tasks) {
		return tasks.map((task) => ({
			...task,
			projectName: task.project ? task.project.name : undefined,
			employees: task.members ? task.members : undefined,
			assignTo: this._getTeamNames(task),
			creator: task.creator ? `${task.creator.name}` : null
		}));
	}

	public _getTeamNames(task) {
		if (task.teams && Array.isArray(task.teams)) {
			return task.teams.map((team) => team.name);
		}
		return [];
	}

	loadAllTasks(tasks: ITask[]): void {
		this._tasks$.next(tasks);
	}

	createTask(task: ITask): Observable<ITask> {
		return this._taskService
			.createTask(task)
			.pipe(
				tap((createdTask) => {
					const tasks = [...this.tasks, createdTask];
					this._tasks$.next(tasks);
				})
			);
	}

	editTask(task: ITask): Observable<ITask> {
		return this._taskService
			.editTask(task)
			.pipe(
				tap(() => {
					const tasks = [...this.tasks];
					const newState = tasks.map((t) =>
						t.id === task.id ? task : t
					);
					this._tasks$.next(newState);
				})
			);
	}

	delete(id: string): Observable<void> {
		return this._taskService
			.deleteTask(id)
			.pipe(
				tap(() => {
					const tasks = [...this.tasks];
					const newState = tasks.filter((t) => t.id !== id);
					this._tasks$.next(newState);
				})
			);
	}

	selectTask(task: ITask) {
		this._selectedTask$.next(task);
	}
}
