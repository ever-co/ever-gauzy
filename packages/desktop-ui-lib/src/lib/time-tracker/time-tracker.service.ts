import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
// import { environment } from '../../../environments/environment';
import * as moment from 'moment';
import { catchError } from 'rxjs/operators';
import { firstValueFrom, throwError } from 'rxjs';
import { TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';

// Import logging for electron and override default console logging
const log = window.require('electron-log');
console.log = log.log;
Object.assign(console, log.functions);

@Injectable({
	providedIn: 'root'
})
export class TimeTrackerService {
	AW_HOST = 'http://localhost:5600';
	token = '';
	userId = '';
	employeeId = '';
	buckets: any = {};

	constructor(private http: HttpClient) {}

	createAuthorizationHeader(headers: Headers) {
		headers.append('Authorization', 'Basic ' + btoa('username:password'));
	}

	async getTasks(values) {
		let tasks;
		try {
			tasks = await this.reqGetTasks(values);
			localStorage.setItem('tasks', JSON.stringify(tasks));
			return tasks;
		} catch (error) {
			tasks = localStorage.getItem('tasks');
			if (tasks) {
				return JSON.parse(tasks);
			}
			throw error;
		}
	}

	reqGetTasks(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return firstValueFrom(this.http
			.get(`${values.apiHost}/api/tasks/employee/${values.employeeId}`, {
				headers: headers,
				params: values.projectId
					? this.toParams({
							data: JSON.stringify({
								findInput: {
									projectId: values.projectId
								}
							})
					  })
					: this.toParams({})
			}));
	}

	async getEmployees(values) {
		let employees;
		try {
			employees = await this.reqGetEmployees(values);
			localStorage.setItem('employees', JSON.stringify(employees));
			return employees;
		} catch (error) {
			employees = localStorage.getItem('employees');
			if (employees) {
				return JSON.parse(employees);
			}
			throw error;
		}
	}

	reqGetEmployees(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return firstValueFrom(this.http
			.get(`${values.apiHost}/api/employee/${values.employeeId}`, {
				headers: headers,
				params: this.toParams({
					data: JSON.stringify({
						relations: [
						  'user'
						],
						findInput: {
							organization: {
							id: values.organizationId
						  }
						}
					  })
				})
			}));
	}

	async getTags(values) {
		let tags;
		try {
			tags = await this.reqGetTags(values);
			localStorage.setItem('tags', JSON.stringify(tags));
			return tags;
		} catch (error) {
			tags = localStorage.getItem('tags');
			if (tags) {
				return JSON.parse(tags);
			}
			throw error;
		}
	}

	reqGetTags(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return firstValueFrom(this.http
			.get(
				`${values.apiHost}/api/tags/level`,
				{
					headers: headers,
					params: values.organizationId
						? this.toParams({
								data: JSON.stringify({
									relations: [
									  'organization'
									],
									findInput: {
									  organizationId: values.organizationId,
									  tenantId: values.tenantId
									}
								  })
						  })
						: this.toParams({})
				}
			));
	}

	async getProjects(values) {
		let projects;
		try {
			projects = await this.reqGetProjects(values);
			localStorage.setItem('projects', JSON.stringify(projects));
			return projects;
		} catch (error) {
			projects = localStorage.getItem('projects');
			if (projects) {
				return JSON.parse(projects);
			}
			throw error;
		}
	}

	reqGetProjects(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return firstValueFrom(this.http
			.get(
				`${values.apiHost}/api/organization-projects/employee/${values.employeeId}`,
				{
					headers: headers,
					params: this.toParams({
						organizationId: values.organizationId,
						tenantId: values.tenantId,
						...(values.organizationContactId
							? {
								organizationContactId: values.organizationContactId
							} : {}),
					})
				}
			));
	}

	async getClient(values) {
		let clients;
		try {
			clients = await this.reqGetClient(values);
			localStorage.setItem('client', JSON.stringify(clients));
			return clients;
		} catch (error) {
			clients = localStorage.getItem('client');
			if (clients) {
				return JSON.parse(clients);
			}
			throw error;
		}
	}

	reqGetClient(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return firstValueFrom(this.http
			.get(
				`${values.apiHost}/api/organization-contact/employee/${values.employeeId}`,
				{
					headers: headers
				}
			));
	}

	async getUserDetail(values) {
		let userDetail;
		try {
			userDetail = await this.reqGetUserDetail(values);
			localStorage.setItem('userDetail', JSON.stringify(userDetail));
			return userDetail;
		} catch (error) {
			userDetail = localStorage.getItem('userDetail');
			if (userDetail) {
				return JSON.parse(userDetail);
			}
			throw error;
		}
	}

	reqGetUserDetail(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		const params = this.toParams({ relations: [
			'tenant',
			'employee',
			'employee.organization',
			'role',
			'role.rolePermissions'
		]});
		return firstValueFrom(
			this.http.get(`${values.apiHost}/api/user/me`, {
				params,
				headers: headers
			})
		);
	}

	async getTimeLogs(values) {
		let timeLogs;
		try {
			timeLogs = await this.reqGetTimeLogs(values);
			localStorage.setItem('timeLogs', JSON.stringify(timeLogs));
			return timeLogs;
		} catch (error) {
			timeLogs = localStorage.getItem('timeLogs');
			if (timeLogs) {
				return JSON.parse(timeLogs);
			}
			throw error;
		}
	}

	reqGetTimeLogs(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		return firstValueFrom(this.http
			.get(`${values.apiHost}/api/timesheet/statistics/counts`, {
				headers: headers,
				params: {
					startDate: moment().startOf('day').utc().format(),
					endDate: moment().endOf('day').utc().format(),
					tenantId: values.tenantId,
					organizationId: values.organizationId
				}
			}));
	}

	async getTimeSlot(values) {
		let timeSLot;
		try {
			timeSLot = await this.reqGetTimeSlot(values);
			localStorage.setItem('timeSlot', JSON.stringify(timeSLot));
			return timeSLot;
		} catch (error) {
			timeSLot = localStorage.getItem('timeSlot');
			if (timeSLot) {
				return JSON.parse(timeSLot);
			}
			throw error;
		}
	}

	reqGetTimeSlot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		log.info(`Get Time Slot: ${moment().format()}`);

		return firstValueFrom(
			this.http
			.get(
				`${values.apiHost}/api/timesheet/time-slot/${values.timeSlotId}?relations[]=screenshots&relations[]=activities&relations[]=employee`,
				{
					headers: headers
				}
			)
		)
	}

	pingAw(host) {
		return firstValueFrom(this.http.get(host));
	}

	toggleApiStart(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
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
			organizationContactId: values.organizationContactId
		};
		log.info(`Toggle Timer Request: ${moment().format()}`, body);
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
			'Tenant-Id': values.tenantId
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
			organizationContactId: values.organizationContactId
		};
		return firstValueFrom(
			this.http.post(
				`${values.apiHost}/api/timesheet/timer/stop`,
				{ ...body },
				{ headers: headers }
			)
		);
	}

	deleteTimeSlot(values) {
		const params = this.toParams({
			ids: [values.timeSlotId],
			tenantId: values.tenantId
		});
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		return firstValueFrom(this.http
			.delete(`${values.apiHost}/api/timesheet/time-slot`, {
				params,
				headers: headers
			}));
	}

	toParams(query) {
		let params: HttpParams = new HttpParams();
		Object.keys(query).forEach((key) => {
			if (this.isJsObject(query[key])) {
				params = this.toSubParams(params, key, query[key]);
			} else {
				params = params.append(key.toString(), query[key]);
			}
		});
		return params;
	}

	isJsObject(object: any) {
		return (
			object !== null &&
			object !== undefined &&
			typeof object === 'object'
		);
	}

	toSubParams(params: HttpParams, key: string, object: any) {
		Object.keys(object).forEach((childKey) => {
			if (this.isJsObject(object[childKey])) {
				params = this.toSubParams(
					params,
					`${key}[${childKey}]`,
					object[childKey]
				);
			} else {
				params = params.append(`${key}[${childKey}]`, object[childKey]);
			}
		});

		return params;
	}

	getInvalidTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		return firstValueFrom(this.http
			.get(`${values.apiHost}/api/timesheet/time-log/`, {
				headers: headers,
				params: {
					tenantId: values.tenantId,
					organizationId: values.organizationId,
					employeeId: values.employeeId,
					source: 'DESKTOP'
				}
			}));
	}

	deleteInvalidTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		const params = this.toParams({
			logIds: values.timeLogIds
		});

		return firstValueFrom(this.http
			.delete(`${values.apiHost}/api/timesheet/time-log`, {
				params,
				headers: headers
			}));
	}

	getTimerStatus(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return firstValueFrom(this.http
			.get(`${values.apiHost}/api/timesheet/timer/status`, {
				params: {
					source: 'DESKTOP',
					tenantId: values.tenantId,
					organizationId: values.organizationId,
					relations: ['employee', 'employee.user'],
				},
				headers: headers
			}));
	}

	collectFromAW(tpURL, start, end) {
		if (!this.buckets.windowBucket) return Promise.resolve([]);
		return firstValueFrom(this.http
			.get(
				`${tpURL}/api/0/buckets/${this.buckets.windowBucket.id}/events?start=${start}&end=${end}&limit=-1`
			));
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

	async collectevents(tpURL, tp, start, end): Promise<any> {
		if (!this.buckets.windowBucket) {
			const allBuckets = await this.getAwBuckets(tpURL);
			this.parseBuckets(allBuckets);
		}
		return this.collectFromAW(tpURL, start, end);
	}

	collectChromeActivityFromAW(tpURL, start, end): Promise<any> {
		if (!this.buckets.chromeBucket) return Promise.resolve([]);
		return firstValueFrom(this.http
			.get(
				`${tpURL}/api/0/buckets/${this.buckets.chromeBucket.id}/events?start=${start}&end=${end}&limit=-1`
			));
	}

	collectFirefoxActivityFromAw(tpURL, start, end): Promise<any> {
		if (!this.buckets.firefoxBucket) return Promise.resolve([]);
		return firstValueFrom( this.http
			.get(
				`${tpURL}/api/0/buckets/${this.buckets.firefoxBucket.id}/events?start=${start}&end=${end}&limit=-1`
			));
	}

	collectAfkFromAW(tpURL, start, end) {
		if (!this.buckets.afkBucket) return Promise.resolve([]);
		return firstValueFrom(this.http
			.get(
				`${tpURL}/api/0/buckets/${this.buckets.afkBucket.id}/events?events?start=${start}&end=${end}&limit=1`
			));
	}

	pushToTimeSlot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`
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
			organizationContactId: values.organizationContactId
		};

		// if (!values.isAw || !values.isAwConnected) {
		// 	delete params.overall;
		// 	delete params.mouse;
		// 	delete params.keyboard;
		// }

		return firstValueFrom(this.http
			.post(`${values.apiHost}/api/timesheet/time-slot`, params, {
				headers: headers
			})
			.pipe(
				catchError((error) => {
					error.error = {
						...error.error,
						params: JSON.stringify(params)
					};
					return throwError(() => new Error(error));
				})
			));
	}

	uploadImages(values, img:any) {
		const  headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		const formData = new FormData();
		const contentType = 'image/png';
	  	const b64Data = img.b64Img;
		const blob = this.b64toBlob(b64Data, contentType);
		formData.append('file', blob, img.fileName);
		formData.append('timeSlotId', values.timeSlotId);
		formData.append('tenantId', values.tenantId);
		formData.append('organizationId', values.organizationId);
		return firstValueFrom(this.http
			.post(`${values.apiHost}/api/timesheet/screenshot`, formData, {
				headers: headers
			})
			.pipe(
				catchError((error) => {
					error.error = {
						...error.error,
						params: JSON.stringify(formData)
					};
					return throwError(() => new Error(error));;
				})
			));
	}

	b64toBlob = (b64Data, contentType='', sliceSize=512) => {
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

		const blob = new Blob(byteArrays, {type: contentType});
		return blob;
	}

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
			'Tenant-Id': values.tenantId
		});
		return firstValueFrom(this.http
			.post(`${values.apiHost}/api/tasks`, payload, {
				headers: headers
			})
			.pipe(
				catchError((error) => {
					error.error = {
						...error.error
					};
					return throwError(() => new Error(error));
				})
			));
	}

}
