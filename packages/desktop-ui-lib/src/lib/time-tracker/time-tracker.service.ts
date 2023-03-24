import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
// import { environment } from '../../../environments/environment';
import * as moment from 'moment';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { firstValueFrom, throwError } from 'rxjs';
import { toUTC, toParams } from '@gauzy/common-angular';
import {
	TimeLogSourceEnum,
	TimeLogType,
	IOrganizationProjectsCreateInput,
	IOrganizationProject,
	IOrganizationContactCreateInput,
	IOrganizationContact,
} from '@gauzy/contracts';
import { ClientCacheService } from '../services/client-cache.service';
import { TaskCacheService } from '../services/task-cache.service';
import { ProjectCacheService } from '../services/project-cache.service';
import { TimeSlotCacheService } from '../services/time-slot-cache.service';
import { UserOrganizationService } from './organization-selector/user-organization.service';
import { EmployeeCacheService } from '../services/employee-cache.service';
import { TagCacheService } from '../services/tag-cache.service';
import { TimeLogCacheService } from '../services/time-log-cache.service';

// Import logging for electron and override default console logging
const log = window.require('electron-log');
console.log = log.log;
Object.assign(console, log.functions);

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
		private readonly _timeLogService: TimeLogCacheService
	) {}

	createAuthorizationHeader(headers: Headers) {
		headers.append('Authorization', 'Basic ' + btoa('username:password'));
	}

	async getTasks(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		const request = {
			where: {
				organizationId: values.organizationId,
				tenantId: values.tenantId,
				...(values.projectId
					? {
							projectId: values.projectId,
					  }
					: {}),
			},
		};
		let tasks$ = this._taskCacheService.getValue(request);
		if (!tasks$) {
			tasks$ = this.http
				.get(
					`${values.apiHost}/api/tasks/employee/${values.employeeId}`,
					{
						headers: headers,
						params: toParams({
							...request,
						}),
					}
				)
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._taskCacheService.setValue(tasks$, request);
		}
		return firstValueFrom(tasks$);
	}
	async getEmployees(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
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
				.get(`${values.apiHost}/api/employee/${values.employeeId}`, {
					headers: headers,
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
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		const params = values.organizationId
			? {
					organizationId: values.organizationId,
					tenantId: values.tenantId,
			  }
			: {};
		let tags$ = this._tagCacheService.getValue(params);
		if (!tags$) {
			tags$ = this.http
				.get(`${values.apiHost}/api/tags/level`, {
					headers,
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
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		const params = {
			organizationId: values.organizationId,
			employeeId: values.employeeId,
			tenantId: values.tenantId,
			...(values.organizationContactId
				? {
						organizationContactId: values.organizationContactId,
				  }
				: {}),
		};
		let projects$ = this._projectCacheService.getValue(params);
		if (!projects$) {
			projects$ = this.http
				.get(
					`${values.apiHost}/api/organization-projects/employee/${values.employeeId}`,
					{
						headers,
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
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		const params = {
			organizationId: values.organizationId,
		};
		let clients$ = this._clientCacheService.getValue(params);
		if (!clients$) {
			clients$ = this.http
				.get(
					`${values.apiHost}/api/organization-contact/employee/${values.employeeId}`,
					{
						headers,
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

	getUserDetail(values) {
		return this._userOrganizationService.detail(values);
	}

	async getTimeLogs(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		let timeLogs$ = this._timeLogService.getValue('counts');
		if (!timeLogs$) {
			timeLogs$ = this.http
				.get(`${values.apiHost}/api/timesheet/statistics/counts`, {
					headers: headers,
					params: toParams({
						tenantId: values.tenantId,
						organizationId: values.organizationId,
						employeeIds: [values.employeeId],
						todayStart: toUTC(moment().startOf('day')).format(
							'YYYY-MM-DD HH:mm:ss'
						),
						todayEnd: toUTC(moment().endOf('day')).format(
							'YYYY-MM-DD HH:mm:ss'
						),
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
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		log.info(`Get Time Slot: ${moment().format()}`);
		let timeSlots$ = this._timeSlotCacheService.getValue(values.timeSlotId);
		if (!timeSlots$) {
			timeSlots$ = this.http
				.get(
					`${values.apiHost}/api/timesheet/time-slot/${values.timeSlotId}?relations[]=screenshots&relations[]=activities&relations[]=employee`,
					{
						headers: headers,
					}
				)
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._timeSlotCacheService.setValue(timeSlots$, values.timeSlotId);
		}
		return firstValueFrom(timeSlots$);
	}

	pingAw(host) {
		return firstValueFrom(this.http.get(host));
	}

	toggleApiStart(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		const body = {
			description: values.note,
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
		};
		log.info(`Toggle Start Timer Request: ${moment().format()}`, body);
		return firstValueFrom(
			this.http.post(
				`${values.apiHost}/api/timesheet/timer/start`,
				{ ...body },
				{ headers: headers }
			)
		);
	}

	toggleApiStop(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		const body = {
			description: values.note,
			isBillable: true,
			logType: TimeLogType.TRACKED,
			projectId: values.projectId,
			taskId: values.taskId,
			source: TimeLogSourceEnum.DESKTOP,
			manualTimeSlot: values.manualTimeSlot,
			organizationId: values.organizationId,
			tenantId: values.tenantId,
			organizationContactId: values.organizationContactId,
			isRunning: false,
			version: values.version,
			startedAt: moment(values.startedAt).utc().toISOString(),
			stoppedAt: moment(values.stoppedAt).utc().toISOString(),
		};
		log.info(`Toggle Stop Timer Request: ${moment().format()}`, body);
		return firstValueFrom(
			this.http.post(
				`${values.apiHost}/api/timesheet/timer/stop`,
				{ ...body },
				{ headers: headers }
			)
		);
	}

	deleteTimeSlot(values) {
		const params = toParams({
			ids: [values.timeSlotId],
			tenantId: values.tenantId,
			organizationId: values.organizationId
		});
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});

		return firstValueFrom(
			this.http.delete(`${values.apiHost}/api/timesheet/time-slot`, {
				params,
				headers: headers,
			})
		);
	}

	deleteTimeSlots(values) {
		const params = toParams({
			ids: [...values.timeslotIds],
			tenantId: values.tenantId,
			organizationId: values.organizationId,
		});
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});

		return firstValueFrom(
			this.http.delete(`${values.apiHost}/api/timesheet/time-slot`, {
				params,
				headers: headers,
			})
		);
	}

	getInvalidTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});

		return firstValueFrom(
			this.http.get(`${values.apiHost}/api/timesheet/time-log/`, {
				headers: headers,
				params: {
					tenantId: values.tenantId,
					organizationId: values.organizationId,
					employeeId: values.employeeId,
					source: 'DESKTOP',
				},
			})
		);
	}

	deleteInvalidTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});

		const params = toParams({
			logIds: values.timeLogIds,
		});

		return firstValueFrom(
			this.http.delete(`${values.apiHost}/api/timesheet/time-log`, {
				params,
				headers: headers,
			})
		);
	}

	getTimerStatus(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		return firstValueFrom(
			this.http.get(`${values.apiHost}/api/timesheet/timer/status`, {
				params: {
					source: 'DESKTOP',
					tenantId: values.tenantId,
					organizationId: values.organizationId,
					relations: ['employee', 'employee.user'],
				},
				headers: headers,
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
		console.log('TimeSlot ✅', values);
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
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
		};

		console.log('Params', params);

		// if (!values.isAw || !values.isAwConnected) {
		// 	delete params.overall;
		// 	delete params.mouse;
		// 	delete params.keyboard;
		// }

		return firstValueFrom(
			this.http
				.post(`${values.apiHost}/api/timesheet/time-slot`, params, {
					headers: headers,
				})
				.pipe(
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
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
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
			this.http
				.post(`${values.apiHost}/api/timesheet/screenshot`, formData, {
					headers: headers,
				})
				.pipe(
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
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		return firstValueFrom(
			this.http
				.post(`${values.apiHost}/api/tasks`, payload, {
					headers: headers,
				})
				.pipe(
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
		createInput: IOrganizationProjectsCreateInput,
		data
	): Promise<IOrganizationProject> {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${data.token}`,
			'Tenant-Id': data.tenantId,
		});
		return firstValueFrom(
			this.http
				.post<IOrganizationProject>(
					data.apiHost + '/api/organization-projects',
					createInput,
					{
						headers: headers,
					}
				)
				.pipe(tap(() => this._projectCacheService.clear()))
		);
	}

	createNewContact(
		input: IOrganizationContactCreateInput,
		values
	): Promise<IOrganizationContact> {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		return firstValueFrom(
			this.http
				.post<IOrganizationContact>(
					`${values.apiHost}/api/organization-contact`,
					input,
					{
						headers: headers,
					}
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
}
