import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as moment from 'moment';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { firstValueFrom, throwError } from 'rxjs';
import { toParams } from '@gauzy/ui-core/common';
import {
	IGetTasksStatistics,
	IOrganizationContact,
	IOrganizationContactCreateInput,
	IOrganizationProject,
	IOrganizationProjectCreateInput,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IPagination,
	ITaskPriority,
	ITaskSize,
	ITaskSizeFindInput,
	ITasksStatistics,
	ITaskStatus,
	ITaskStatusFindInput,
	ITaskUpdateInput,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import {
	ClientCacheService,
	EmployeeCacheService,
	ProjectCacheService,
	Store,
	TaskCacheService,
	TaskPriorityCacheService,
	TaskSizeCacheService,
	TaskStatusCacheService,
	TeamsCacheService,
	TimeLogCacheService,
	TimeSlotCacheService,
	TimeTrackerDateManager
} from '../services';
import { UserOrganizationService } from './organization-selector/user-organization.service';
import { LoggerService } from '../electron/services';
import { API_PREFIX } from '../constants';

@Injectable({
	providedIn: 'root'
})
export class TimeTrackerService {
	token = '';
	userId = '';
	employeeId = '';

	constructor(
		private readonly http: HttpClient,
		private readonly _clientCacheService: ClientCacheService,
		private readonly _taskCacheService: TaskCacheService,
		private readonly _projectCacheService: ProjectCacheService,
		private readonly _timeSlotCacheService: TimeSlotCacheService,
		private readonly _employeeCacheService: EmployeeCacheService,
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _timeLogService: TimeLogCacheService,
		private readonly _loggerService: LoggerService,
		private readonly _store: Store,
		private readonly _taskStatusCacheService: TaskStatusCacheService,
		private readonly _teamsCacheService: TeamsCacheService,
		private readonly _taskPriorityCacheService: TaskPriorityCacheService,
		private readonly _taskSizeCacheService: TaskSizeCacheService
	) {}

	createAuthorizationHeader(headers: Headers) {
		headers.append('Authorization', 'Basic ' + btoa('username:password'));
	}

	async getTasks(values) {
		const request = {
			where: {
				organizationId: values.organizationId,
				tenantId: values.tenantId,
				...(values.projectId
					? {
							projectId: values.projectId
					  }
					: {}),
				...(values.organizationTeamId && {
					teams: {
						id: values.organizationTeamId
					}
				})
			},
			relations: [
				'project',
				'tags',
				'teams',
				'teams.members',
				'teams.members.employee',
				'teams.members.employee.user',
				'creator',
				'organizationSprint',
				'taskStatus',
				'taskSize',
				'taskPriority'
			],
			join: {
				alias: 'task',
				leftJoinAndSelect: {
					members: 'task.members',
					user: 'members.user'
				}
			}
		};
		let tasks$ = this._taskCacheService.getValue(request);
		if (!tasks$) {
			tasks$ = this.http
				.get(`${API_PREFIX}/tasks/employee/${values.employeeId}`, {
					params: toParams(request)
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._taskCacheService.setValue(tasks$, request);
		}
		return firstValueFrom(tasks$);
	}

	/**
	 * Fetch tasks statistics via POST request
	 *
	 * @param values
	 * @returns
	 */
	public async getTasksStatistics(values: IGetTasksStatistics) {
		const request: IGetTasksStatistics = {
			organizationId: values.organizationId,
			tenantId: values.tenantId,
			taskIds: values.taskIds,
			startDate: moment(0).utc().toISOString(),
			endDate: TimeTrackerDateManager.endToday,
			todayStart: TimeTrackerDateManager.startToday,
			todayEnd: TimeTrackerDateManager.endToday,
			...(values.projectId ? { projectId: values.projectId } : {})
		};

		const cacheReference = {
			taskIds: values.taskIds,
			projectId: values.projectId
		};
		let tasksStatistics$ = this._taskCacheService.getValue(cacheReference);

		if (!tasksStatistics$) {
			// Fetch tasks statistics
			const tasks$ = this.http.post<ITasksStatistics[]>(`${API_PREFIX}/timesheet/statistics/tasks`, request);

			// Map the response to the task statistics
			tasks$.pipe(
				map((response: any) => response),
				shareReplay(1)
			);

			// Set the tasks statistics in the cache
			this._taskCacheService.setValue(tasksStatistics$, cacheReference);
		}

		// Return the tasks statistics
		return await firstValueFrom(tasksStatistics$);
	}

	async getEmployees(values) {
		const params = {
			data: JSON.stringify({
				relations: ['user'],
				findInput: {
					organization: {
						id: values.organizationId
					}
				}
			})
		};
		let employee$ = this._employeeCacheService.getValue(params);
		if (!employee$) {
			employee$ = this.http
				.get(`${API_PREFIX}/employee/${values.employeeId}`, {
					params: toParams(params)
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._employeeCacheService.setValue(employee$, params);
		}
		return firstValueFrom(employee$);
	}

	async getProjects(values) {
		const params = {
			organizationId: values.organizationId,
			employeeId: values.employeeId,
			tenantId: values.tenantId,
			...(values.organizationContactId
				? {
						organizationContactId: values.organizationContactId
				  }
				: {}),
			...(values.organizationTeamId && {
				organizationTeamId: values.organizationTeamId
			})
		};
		let projects$ = this._projectCacheService.getValue(params);
		if (!projects$) {
			projects$ = this.http
				.get(`${API_PREFIX}/organization-projects/employee/${values.employeeId}`, {
					params: toParams(params)
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._projectCacheService.setValue(projects$, params);
		}
		return firstValueFrom(projects$);
	}

	async getClient(values) {
		const params = {
			organizationId: values.organizationId
		};
		let clients$ = this._clientCacheService.getValue(params);
		if (!clients$) {
			clients$ = this.http
				.get(`${API_PREFIX}/organization-contact/employee/${values.employeeId}`, {
					params
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._clientCacheService.setValue(clients$, params);
		}
		return firstValueFrom(clients$);
	}

	getUserDetail() {
		return this._userOrganizationService.detail();
	}

	async getTimeLogs(values) {
		console.log('TimeLogs', values);
		let timeLogs$ = this._timeLogService.getValue('counts');
		if (!timeLogs$) {
			timeLogs$ = this.http
				.get(`${API_PREFIX}/timesheet/statistics/counts`, {
					params: toParams({
						tenantId: values.tenantId,
						organizationId: values.organizationId,
						employeeIds: [values.employeeId],
						todayStart: TimeTrackerDateManager.startToday,
						todayEnd: TimeTrackerDateManager.endToday,
						startDate: TimeTrackerDateManager.startWeek,
						endDate: TimeTrackerDateManager.endWeek
					})
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._timeLogService.setValue(timeLogs$, 'counts');
		}
		return firstValueFrom(timeLogs$);
	}

	async getTimeSlot(values) {
		this._loggerService.log.info(`Get Time Slot: ${moment().format()}`);
		const { tenantId, organizationId } = this._store;
		const params = toParams({
			tenantId,
			organizationId,
			relations: ['screenshots']
		});
		let timeSlots$ = this._timeSlotCacheService.getValue(values.timeSlotId);
		if (!timeSlots$) {
			timeSlots$ = this.http
				.get(`${API_PREFIX}/timesheet/time-slot/${values.timeSlotId}`, {
					params
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._timeSlotCacheService.setValue(timeSlots$, values.timeSlotId);
		}
		return firstValueFrom(timeSlots$);
	}

	pingAw(host) {
		return firstValueFrom(this.http.get(host, { responseType: 'text' }));
	}

	toggleApiStart(values) {
		const options = {
			headers: new HttpHeaders({ timeout: `${15 * 1000}` })
		};
		const body = {
			description: values.description,
			isBillable: true,
			logType: TimeLogType.TRACKED,
			projectId: values.projectId,
			taskId: values.taskId,
			source: TimeLogSourceEnum.DESKTOP,
			manualTimeSlot: values.manualTimeSlot,
			organizationId: values.organizationId,
			tenantId: values.tenantId,
			organizationContactId: values.organizationContactId,
			isRunning: true,
			version: values.version,
			startedAt: moment(values.startedAt).utc().toISOString(),
			organizationTeamId: values.organizationTeamId
		};
		this._loggerService.log.info(`Toggle Start Timer Request: ${moment().format()}`, body);
		return firstValueFrom(this.http.post(`${API_PREFIX}/timesheet/timer/start`, { ...body }, options));
	}

	toggleApiStop(values) {
		const options = {
			headers: new HttpHeaders({ timeout: `${15 * 1000}` })
		};
		const body = {
			description: values.description,
			isBillable: true,
			logType: TimeLogType.TRACKED,
			projectId: values.projectId,
			taskId: values.taskId,
			manualTimeSlot: values.manualTimeSlot,
			organizationId: values.organizationId,
			tenantId: values.tenantId,
			organizationContactId: values.organizationContactId,
			isRunning: false,
			version: values.version,
			startedAt: moment(values.startedAt).utc().toISOString(),
			stoppedAt: moment(values.stoppedAt).utc().toISOString(),
			organizationTeamId: values.organizationTeamId
		};
		this._loggerService.log.info(`Toggle Stop Timer Request: ${moment().format()}`, body);
		return firstValueFrom(this.http.post(`${API_PREFIX}/timesheet/timer/stop`, { ...body }, options));
	}

	deleteTimeSlot(values) {
		const params = toParams({
			ids: [values.timeSlotId],
			tenantId: values.tenantId,
			organizationId: values.organizationId
		});

		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/timesheet/time-slot`, {
				params
			})
		);
	}

	deleteTimeSlots(values) {
		const params = toParams({
			ids: [...values.timeslotIds],
			tenantId: values.tenantId,
			organizationId: values.organizationId
		});

		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/timesheet/time-slot`, {
				params
			})
		);
	}

	getInvalidTimeLog(values) {
		return firstValueFrom(
			this.http.get(`${API_PREFIX}/timesheet/time-log/`, {
				params: {
					tenantId: values.tenantId,
					organizationId: values.organizationId,
					employeeId: values.employeeId,
					source: TimeLogSourceEnum.DESKTOP
				}
			})
		);
	}

	deleteInvalidTimeLog(values) {
		const params = toParams({
			logIds: values.timeLogIds
		});

		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/timesheet/time-log`, {
				params
			})
		);
	}

	getTimerStatus(values) {
		return firstValueFrom(
			this.http.get(`${API_PREFIX}/timesheet/timer/status`, {
				params: {
					tenantId: values.tenantId,
					organizationId: values.organizationId,
					relations: ['employee', 'employee.user']
				}
			})
		);
	}

	pushToTimeSlot(values) {
		console.log('✅ - TimeSlot', values);
		const params = {
			employeeId: values.employeeId,
			projectId: values.projectId,
			duration: values.duration,
			keyboard: values.keyboard,
			mouse: values.mouse,
			overall: values.overall,
			startedAt: values.startedAt,
			activities: values.activities,
			timeLogId: values.timeLogId,
			organizationId: values.organizationId,
			tenantId: values.tenantId,
			organizationContactId: values.organizationContactId,
			recordedAt: moment(values.recordedAt).utc().toISOString(),
			...(values.timesheetId && { timesheetId: values.timesheetId })
		};

		console.log('Params', params);

		return firstValueFrom(
			this.http.post(`${API_PREFIX}/timesheet/time-slot`, params).pipe(
				catchError((error) => {
					error.error = {
						...error.error,
						params: JSON.stringify(params)
					};
					return throwError(() => new Error(error));
				})
			)
		);
	}

	uploadImages(values, img: any) {
		const formData = new FormData();
		const contentType = 'image/png';
		const b64Data = img.b64Img;
		const blob = this.b64toBlob(b64Data, contentType);
		formData.append('file', blob, img.fileName);
		formData.append('timeSlotId', values.timeSlotId);
		formData.append('tenantId', values.tenantId);
		formData.append('organizationId', values.organizationId);
		formData.append('recordedAt', moment(values.recordedAt).utc().toISOString());
		return firstValueFrom(
			this.http.post(`${API_PREFIX}/timesheet/screenshot`, formData).pipe(
				catchError((error) => {
					error.error = {
						...error.error,
						params: JSON.stringify(formData)
					};
					return throwError(() => new Error(error));
				})
			)
		);
	}

	b64toBlob = (b64Data, contentType = '', sliceSize = 512) => {
		const byteCharacters = atob(b64Data);
		const byteArrays = [];

		for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
			const slice = byteCharacters.slice(offset, offset + sliceSize);

			const byteNumbers = new Array(slice.length);
			for (let i = 0; i < slice.length; i++) {
				byteNumbers[i] = slice.charCodeAt(i);
			}

			const byteArray = new Uint8Array(byteNumbers);
			byteArrays.push(byteArray);
		}

		const blob = new Blob(byteArrays, { type: contentType });
		return blob;
	};

	convertToSlug(text: string) {
		return text
			.toString()
			.toLowerCase()
			.replace(/\s+/g, '-') // Replace spaces with -
			.replace(/\-\-+/g, '-') // Replace multiple - with single -
			.replace(/^-+/, '') // Trim - from start of text
			.replace(/-+$/, ''); // Trim - from end of text
	}

	async pingServer(values) {
		try {
			await this.pingApi(values);
			return true;
		} catch (error) {
			if (error.status === 404) {
				return true;
			}
			return false;
		}
	}

	pingApi(values) {
		return firstValueFrom(this.http.get(values.apiHost));
	}

	saveNewTask(values, payload) {
		return firstValueFrom(
			this.http.post(`${API_PREFIX}/tasks`, payload).pipe(
				tap(() => this._taskCacheService.clear()),
				catchError((error) => {
					error.error = {
						...error.error
					};
					return throwError(() => new Error(error));
				})
			)
		);
	}

	createNewProject(createInput: IOrganizationProjectCreateInput, data): Promise<IOrganizationProject> {
		return firstValueFrom(
			this.http
				.post<IOrganizationProject>(`${API_PREFIX}/organization-projects`, createInput)
				.pipe(tap(() => this._projectCacheService.clear()))
		);
	}

	createNewContact(input: IOrganizationContactCreateInput, values): Promise<IOrganizationContact> {
		return firstValueFrom(
			this.http.post<IOrganizationContact>(`${API_PREFIX}/organization-contact`, input).pipe(
				tap(() => this._clientCacheService.clear()),
				catchError((error) => {
					error.error = {
						...error.error
					};
					return throwError(() => new Error(error));
				})
			)
		);
	}

	public async updateTask(id: string, taskUpdateInput: ITaskUpdateInput) {
		return firstValueFrom(
			this.http.put<IOrganizationContact>(`${API_PREFIX}/tasks/${id}`, taskUpdateInput).pipe(
				tap(() => this._taskCacheService.clear()),
				tap(() => this._taskStatusCacheService.clear()),
				catchError((error) => {
					error.error = {
						...error.error
					};
					return throwError(() => new Error(error));
				})
			)
		);
	}

	public async statuses(params: ITaskStatusFindInput): Promise<ITaskStatus[]> {
		let taskStatuses$ = this._taskStatusCacheService.getValue(params);
		if (!taskStatuses$) {
			taskStatuses$ = this.http
				.get<IPagination<ITaskStatus>>(`${API_PREFIX}/task-statuses`, {
					params: toParams({ ...params })
				})
				.pipe(
					map((res) => res.items),
					shareReplay(1)
				);
			this._taskStatusCacheService.setValue(taskStatuses$, params);
		}
		return firstValueFrom(taskStatuses$);
	}

	public async updateOrganizationTeamEmployee(
		employeeId: string,
		values: Partial<IOrganizationTeamEmployee>
	): Promise<any> {
		const params = {
			organizationId: values.organizationId,
			activeTaskId: values.activeTaskId,
			organizationTeamId: values.organizationTeamId,
			tenantId: values.tenantId
		};
		return firstValueFrom(this.http.put(`${API_PREFIX}/organization-team-employee/${employeeId}`, params));
	}

	public async getTeams(values?: any): Promise<IOrganizationTeam[]> {
		const params = {
			where: {
				organizationId: this._store.organizationId,
				tenantId: this._store.tenantId,
				...(values?.projectId && {
					projects: {
						id: values.projectId
					}
				})
			},
			relations: ['projects']
		};
		let teams$ = this._teamsCacheService.getValue(params);
		if (!teams$) {
			teams$ = this.http
				.get<IPagination<IOrganizationTeam>>(`${API_PREFIX}/organization-team/me`, {
					params: toParams({ ...params })
				})
				.pipe(
					map((res) => res.items),
					shareReplay(1)
				);
			this._teamsCacheService.setValue(teams$, params);
		}
		return firstValueFrom(teams$);
	}

	public async taskSizes(): Promise<ITaskSize[]> {
		const params: ITaskSizeFindInput = {
			organizationId: this._store.organizationId,
			tenantId: this._store.tenantId
		};
		let taskSizes$ = this._taskSizeCacheService.getValue(params);
		if (!taskSizes$) {
			taskSizes$ = this.http
				.get<IPagination<ITaskSize>>(`${API_PREFIX}/task-sizes`, {
					params: toParams({ ...params })
				})
				.pipe(
					map((res) => res.items),
					shareReplay(1)
				);
			this._taskSizeCacheService.setValue(taskSizes$, params);
		}
		return firstValueFrom(taskSizes$);
	}

	public async taskPriorities(): Promise<ITaskPriority[]> {
		const params: ITaskSizeFindInput = {
			organizationId: this._store.organizationId,
			tenantId: this._store.tenantId
		};
		let taskPriorities$ = this._taskPriorityCacheService.getValue(params);
		if (!taskPriorities$) {
			taskPriorities$ = this.http
				.get<IPagination<ITaskPriority>>(`${API_PREFIX}/task-priorities`, {
					params: toParams({ ...params })
				})
				.pipe(
					map((res) => res.items),
					shareReplay(1)
				);
			this._taskPriorityCacheService.setValue(taskPriorities$, params);
		}
		return firstValueFrom(taskPriorities$);
	}
}
