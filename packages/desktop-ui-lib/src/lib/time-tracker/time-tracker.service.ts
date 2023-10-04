import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
// import { environment } from '../../../environments/environment';
import * as moment from 'moment';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { firstValueFrom, throwError } from 'rxjs';
import { toParams } from '@gauzy/common-angular';
import {
	IGetTasksStatistics,
	IOrganizationContact,
	IOrganizationContactCreateInput,
	IOrganizationProject,
	IOrganizationProjectCreateInput,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IPagination,
	ITaskStatus,
	ITaskStatusFindInput,
	ITaskUpdateInput,
	TimeLogSourceEnum,
	TimeLogType,
} from '@gauzy/contracts';
import { ClientCacheService } from '../services/client-cache.service';
import { TaskCacheService } from '../services/task-cache.service';
import { ProjectCacheService } from '../services/project-cache.service';
import { TimeSlotCacheService } from '../services/time-slot-cache.service';
import { UserOrganizationService } from './organization-selector/user-organization.service';
import { EmployeeCacheService } from '../services/employee-cache.service';
import { TagCacheService } from '../services/tag-cache.service';
import { TimeLogCacheService } from '../services/time-log-cache.service';
import { LoggerService } from '../electron/services';
import { API_PREFIX } from '../constants/app.constants';
import {
	Store,
	TaskStatusCacheService,
	TeamsCacheService,
	TimeTrackerDateManager,
} from '../services';

@Injectable({
	providedIn: 'root',
})
export class TimeTrackerService {
	AW_HOST = 'http://localhost:5600';
	token = '';
	userId = '';
	employeeId = '';
	buckets: any = {};

	constructor(
		private readonly http: HttpClient,
		private readonly _clientCacheService: ClientCacheService,
		private readonly _taskCacheService: TaskCacheService,
		private readonly _projectCacheService: ProjectCacheService,
		private readonly _timeSlotCacheService: TimeSlotCacheService,
		private readonly _employeeCacheService: EmployeeCacheService,
		private readonly _tagCacheService: TagCacheService,
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _timeLogService: TimeLogCacheService,
		private readonly _loggerService: LoggerService,
		private readonly _store: Store,
		private readonly _taskStatusCacheService: TaskStatusCacheService,
		private readonly _teamsCacheService: TeamsCacheService
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
							projectId: values.projectId,
					  }
					: {}),
				...(values.organizationTeamId && {
					teams: {
						id: values.organizationTeamId,
					},
				}),
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
				'taskPriority',
			],
			join: {
				alias: 'task',
				leftJoinAndSelect: {
					members: 'task.members',
					user: 'members.user',
				},
			},
		};
		let tasks$ = this._taskCacheService.getValue(request);
		if (!tasks$) {
			tasks$ = this.http
				.get(`${API_PREFIX}/tasks/employee/${values.employeeId}`, {
					params: toParams(request),
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._taskCacheService.setValue(tasks$, request);
		}
		return firstValueFrom(tasks$);
	}

	public async getTasksStatistics(values: IGetTasksStatistics) {
		const request: IGetTasksStatistics = {
			organizationId: values.organizationId,
			tenantId: values.tenantId,
			taskIds: values.taskIds,
			startDate: moment(0).utc().toISOString(),
			endDate: TimeTrackerDateManager.endToday,
			todayStart: TimeTrackerDateManager.startToday,
			todayEnd: TimeTrackerDateManager.endToday,
			...(values.projectId
				? {
						projectId: values.projectId,
				  }
				: {}),
		};
		const cacheReference = {
			taskIds: values.taskIds,
			projectId: values.projectId,
		};
		let tasksStatistics$ = this._taskCacheService.getValue(cacheReference);
		if (!tasksStatistics$) {
			tasksStatistics$ = this.http
				.get(`${API_PREFIX}/timesheet/statistics/tasks`, {
					params: toParams({
						...request,
					}),
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._taskCacheService.setValue(tasksStatistics$, cacheReference);
		}
		return firstValueFrom(tasksStatistics$);
	}

	async getEmployees(values) {
		const params = {
			data: JSON.stringify({
				relations: ['user'],
				findInput: {
					organization: {
						id: values.organizationId,
					},
				},
			}),
		};
		let employee$ = this._employeeCacheService.getValue(params);
		if (!employee$) {
			employee$ = this.http
				.get(`${API_PREFIX}/employee/${values.employeeId}`, {
					params: toParams(params),
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._employeeCacheService.setValue(employee$, params);
		}
		return firstValueFrom(employee$);
	}

	async getTags(values) {
		const params = values.organizationId
			? {
					organizationId: values.organizationId,
					tenantId: values.tenantId,
			  }
			: {};
		let tags$ = this._tagCacheService.getValue(params);
		if (!tags$) {
			tags$ = this.http
				.get(`${API_PREFIX}/tags/level`, {
					params: toParams(params),
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._tagCacheService.setValue(tags$, params);
		}
		return firstValueFrom(tags$);
	}

	async getProjects(values) {
		const params = {
			organizationId: values.organizationId,
			employeeId: values.employeeId,
			tenantId: values.tenantId,
			...(values.organizationContactId
				? {
						organizationContactId: values.organizationContactId,
				  }
				: {}),
			...(values.organizationTeamId && {
				organizationTeamId:values.organizationTeamId,
				})
		};
		let projects$ = this._projectCacheService.getValue(params);
		if (!projects$) {
			projects$ = this.http
				.get(
					`${API_PREFIX}/organization-projects/employee/${values.employeeId}`,
					{
						params: toParams(params),
					}
				)
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
			organizationId: values.organizationId,
		};
		let clients$ = this._clientCacheService.getValue(params);
		if (!clients$) {
			clients$ = this.http
				.get(
					`${API_PREFIX}/organization-contact/employee/${values.employeeId}`,
					{
						params,
					}
				)
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
						endDate: TimeTrackerDateManager.endWeek,
					}),
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
			relations: ['screenshots'],
		});
		let timeSlots$ = this._timeSlotCacheService.getValue(values.timeSlotId);
		if (!timeSlots$) {
			timeSlots$ = this.http
				.get(`${API_PREFIX}/timesheet/time-slot/${values.timeSlotId}`, {
					params,
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
			headers: new HttpHeaders({ timeout: `${15 * 1000}` }),
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
			organizationTeamId: values.organizationTeamId,
		};
		this._loggerService.log.info(
			`Toggle Start Timer Request: ${moment().format()}`,
			body
		);
		return firstValueFrom(
			this.http.post(
				`${API_PREFIX}/timesheet/timer/start`,
				{ ...body },
				options
			)
		);
	}

	toggleApiStop(values) {
		const options = {
			headers: new HttpHeaders({ timeout: `${15 * 1000}` }),
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
			organizationTeamId: values.organizationTeamId,
		};
		this._loggerService.log.info(
			`Toggle Stop Timer Request: ${moment().format()}`,
			body
		);
		return firstValueFrom(
			this.http.post(
				`${API_PREFIX}/timesheet/timer/stop`,
				{ ...body },
				options
			)
		);
	}

	deleteTimeSlot(values) {
		const params = toParams({
			ids: [values.timeSlotId],
			tenantId: values.tenantId,
			organizationId: values.organizationId,
		});

		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/timesheet/time-slot`, {
				params,
			})
		);
	}

	deleteTimeSlots(values) {
		const params = toParams({
			ids: [...values.timeslotIds],
			tenantId: values.tenantId,
			organizationId: values.organizationId,
		});

		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/timesheet/time-slot`, {
				params,
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
					source: TimeLogSourceEnum.DESKTOP,
				},
			})
		);
	}

	deleteInvalidTimeLog(values) {
		const params = toParams({
			logIds: values.timeLogIds,
		});

		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/timesheet/time-log`, {
				params,
			})
		);
	}

	getTimerStatus(values) {
		return firstValueFrom(
			this.http.get(`${API_PREFIX}/timesheet/timer/status`, {
				params: {
					tenantId: values.tenantId,
					organizationId: values.organizationId,
					relations: ['employee', 'employee.user'],
				},
			})
		);
	}

	collectFromAW(tpURL, start, end) {
		if (!this.buckets.windowBucket) return Promise.resolve([]);
		return firstValueFrom(
			this.http.get(
				`${tpURL}/api/0/buckets/${this.buckets.windowBucket.id}/events?start=${start}&end=${end}&limit=-1`
			)
		);
	}

	getAwBuckets(tpURL): Promise<any> {
		return firstValueFrom(this.http.get(`${tpURL}/api/0/buckets`));
	}

	parseBuckets(buckets) {
		Object.keys(buckets).forEach((key) => {
			const keyParse = key.split('_')[0];
			switch (keyParse) {
				case 'aw-watcher-window':
					this.buckets.windowBucket = buckets[key];
					break;
				case 'aw-watcher-afk':
					this.buckets.afkBucket = buckets[key];
					break;
				case 'aw-watcher-web-chrome':
					this.buckets.chromeBucket = buckets[key];
					break;
				case 'aw-watcher-web-firefox':
					this.buckets.firefoxBucket = buckets[key];
					break;
				default:
					break;
			}
		});
	}

	async collectEvents(tpURL, tp, start, end): Promise<any> {
		if (!this.buckets.windowBucket) {
			const allBuckets = await this.getAwBuckets(tpURL);
			this.parseBuckets(allBuckets);
		}
		return this.collectFromAW(tpURL, start, end);
	}

	collectChromeActivityFromAW(tpURL, start, end): Promise<any> {
		if (!this.buckets.chromeBucket) return Promise.resolve([]);
		return firstValueFrom(
			this.http.get(
				`${tpURL}/api/0/buckets/${this.buckets.chromeBucket.id}/events?start=${start}&end=${end}&limit=-1`
			)
		);
	}

	collectFirefoxActivityFromAw(tpURL, start, end): Promise<any> {
		if (!this.buckets.firefoxBucket) return Promise.resolve([]);
		return firstValueFrom(
			this.http.get(
				`${tpURL}/api/0/buckets/${this.buckets.firefoxBucket.id}/events?start=${start}&end=${end}&limit=-1`
			)
		);
	}

	collectAfkFromAW(tpURL, start, end) {
		if (!this.buckets.afkBucket) return Promise.resolve([]);
		return firstValueFrom(
			this.http.get(
				`${tpURL}/api/0/buckets/${this.buckets.afkBucket.id}/events?events?start=${start}&end=${end}&limit=1`
			)
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
			...(values.timesheetId && { timesheetId: values.timesheetId }),
		};

		console.log('Params', params);

		// if (!values.isAw || !values.isAwConnected) {
		// 	delete params.overall;
		// 	delete params.mouse;
		// 	delete params.keyboard;
		// }

		return firstValueFrom(
			this.http.post(`${API_PREFIX}/timesheet/time-slot`, params).pipe(
				catchError((error) => {
					error.error = {
						...error.error,
						params: JSON.stringify(params),
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
		formData.append(
			'recordedAt',
			moment(values.recordedAt).utc().toISOString()
		);
		return firstValueFrom(
			this.http.post(`${API_PREFIX}/timesheet/screenshot`, formData).pipe(
				catchError((error) => {
					error.error = {
						...error.error,
						params: JSON.stringify(formData),
					};
					return throwError(() => new Error(error));
				})
			)
		);
	}

	b64toBlob = (b64Data, contentType = '', sliceSize = 512) => {
		const byteCharacters = atob(b64Data);
		const byteArrays = [];

		for (
			let offset = 0;
			offset < byteCharacters.length;
			offset += sliceSize
		) {
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
						...error.error,
					};
					return throwError(() => new Error(error));
				})
			)
		);
	}

	createNewProject(
		createInput: IOrganizationProjectCreateInput,
		data
	): Promise<IOrganizationProject> {
		return firstValueFrom(
			this.http
				.post<IOrganizationProject>(
					`${API_PREFIX}/organization-projects`,
					createInput
				)
				.pipe(tap(() => this._projectCacheService.clear()))
		);
	}

	createNewContact(
		input: IOrganizationContactCreateInput,
		values
	): Promise<IOrganizationContact> {
		return firstValueFrom(
			this.http
				.post<IOrganizationContact>(
					`${API_PREFIX}/organization-contact`,
					input
				)
				.pipe(
					tap(() => this._clientCacheService.clear()),
					catchError((error) => {
						error.error = {
							...error.error,
						};
						return throwError(() => new Error(error));
					})
				)
		);
	}

	public async updateTask(id: string, taskUpdateInput: ITaskUpdateInput) {
		return firstValueFrom(
			this.http
				.put<IOrganizationContact>(
					`${API_PREFIX}/tasks/${id}`,
					taskUpdateInput
				)
				.pipe(
					tap(() => this._taskCacheService.clear()),
					tap(() => this._taskStatusCacheService.clear()),
					catchError((error) => {
						error.error = {
							...error.error,
						};
						return throwError(() => new Error(error));
					})
				)
		);
	}

	public async statuses(
		params: ITaskStatusFindInput
	): Promise<ITaskStatus[]> {
		let taskStatuses$ = this._taskStatusCacheService.getValue(params);
		if (!taskStatuses$) {
			taskStatuses$ = this.http
				.get<IPagination<ITaskStatus>>(`${API_PREFIX}/task-statuses`, {
					params: toParams({ ...params }),
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
			tenantId: values.tenantId,
		};
		return firstValueFrom(
			this.http.put(
				`${API_PREFIX}/organization-team-employee/${employeeId}`,
				params
			)
		);
	}

	public async getTeams(): Promise<IOrganizationTeam[]> {
		const params = {
			where: {
				organizationId: this._store.organizationId,
				tenantId: this._store.tenantId,
			},
		};
		let teams$ = this._teamsCacheService.getValue(params);
		if (!teams$) {
			teams$ = this.http
				.get<IPagination<IOrganizationTeam>>(
					`${API_PREFIX}/organization-team/me`,
					{
						params: toParams({ ...params }),
					}
				)
				.pipe(
					map((res) => res.items),
					shareReplay(1)
				);
			this._teamsCacheService.setValue(teams$, params);
		}
		return firstValueFrom(teams$);
	}
}
