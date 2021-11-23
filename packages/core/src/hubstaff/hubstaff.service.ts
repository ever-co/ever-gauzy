import {
	Injectable,
	BadRequestException,
	HttpException
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { CommandBus } from '@nestjs/cqrs';
import { DeepPartial } from 'typeorm';
import { map, catchError, switchMap } from 'rxjs/operators';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';
import { isEmpty, isNotEmpty, isObject } from '@gauzy/common';
import {
	ICreateIntegrationDto,
	IIntegrationTenant,
	IntegrationEnum,
	IntegrationEntity,
	IIntegrationMap,
	IIntegrationSetting,
	RolesEnum,
	TimeLogType,
	ContactType,
	CurrenciesEnum,
	ProjectBillingEnum,
	TimeLogSourceEnum,
	IHubstaffOrganization,
	IHubstaffProject,
	IIntegrationEntitySetting,
	IDateRangeActivityFilter,
	ComponentLayoutStyleEnum,
	ActivityType,
	IDateRange
} from '@gauzy/contracts';
import {
	DEFAULT_ENTITY_SETTINGS,
	HUBSTAFF_AUTHORIZATION_URL,
	PROJECT_TIED_ENTITIES
} from '@gauzy/integration-hubstaff';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { IntegrationTenantService } from '../integration-tenant/integration-tenant.service';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import {
	OrganizationCreateCommand,
	OrganizationUpdateCommand
} from '../organization/commands';
import { OrganizationContactCreateCommand } from '../organization-contact/commands';
import { TaskCreateCommand } from '../tasks/commands';
import { EmployeeCreateCommand, EmployeeGetCommand } from '../employee/commands';
import { RoleService } from '../role/role.service';
import { OrganizationService } from '../organization/organization.service';
import { UserService } from '../user/user.service';
import { ScreenshotCreateCommand } from './../time-tracking/screenshot/commands';
import { TimeSlotCreateCommand } from './../time-tracking/time-slot/commands';
import { ActivityCreateCommand } from './../time-tracking/activity/commands';
import { TimeLogCreateCommand } from '../time-tracking/time-log/commands';
import { IntegrationMapSyncEntityCommand } from './../integration-map/commands';
import {
	OrganizationProjectCreateCommand,
	OrganizationProjectUpdateCommand
} from '../organization-project/commands';
import { TaskUpdateCommand } from '../tasks/commands';
import { RequestContext } from '../core/context';
import { mergeOverlappingDateRanges } from 'core/utils';

@Injectable()
export class HubstaffService {
	constructor(
		private readonly _httpService: HttpService,
		private readonly _integrationService: IntegrationTenantService,
		private readonly _integrationSettingService: IntegrationSettingService,
		private readonly _integrationMapService: IntegrationMapService,
		private readonly _roleService: RoleService,
		private readonly _organizationService: OrganizationService,
		private readonly _userService: UserService,
		private readonly commandBus: CommandBus
	) {}

	async fetchIntegration<T = any>(url: string, token: string): Promise<any> {
		const headers = {
			Authorization: `Bearer ${token}`
		};
		return firstValueFrom(
			this._httpService.get(url, { headers }).pipe(
				catchError((error: AxiosError<any>) => {
					const response: AxiosResponse<any>  = error.response;

					const status = response.status;
					const statusText = response.statusText;
					const data = response.data;

					/**
					 * Handle hubstaff http exception
					 */
					throw new HttpException({
						statusCode: status,
						error: statusText,
						message: data.error
					}, response.status);
				}),
				map(
					(response: AxiosResponse<T>) => response.data
				)
			)
		);
	}

	async refreshToken(integrationId) {
		const {
			items: settings
		} = await this._integrationSettingService.findAll({
			where: {
				integration: { id: integrationId }
			}
		});
		const headers = {
			'Content-Type': 'application/x-www-form-urlencoded'
		};

		const urlParams = new URLSearchParams();

		const { client_id, client_secret, refresh_token } = settings.reduce(
			(prev, current) => {
				return {
					...prev,
					client_id:
						current.settingsName === 'client_id'
							? current.settingsValue
							: prev.client_id,
					client_secret:
						current.settingsName === 'client_secret'
							? current.settingsValue
							: prev.client_secret,
					refresh_token:
						current.settingsName === 'refresh_token'
							? current.settingsValue
							: prev.refresh_token
				};
			},
			{
				client_id: '',
				client_secret: '',
				refresh_token: ''
			}
		);
		urlParams.append('grant_type', 'refresh_token');
		urlParams.append('refresh_token', refresh_token);
		urlParams.append('client_id', client_id);
		urlParams.append('client_secret', client_secret);

		try {
			const tokens$ = this._httpService.post(`${HUBSTAFF_AUTHORIZATION_URL}/access_tokens`, urlParams, {
				headers
			})
			.pipe(
				map(
					(response: AxiosResponse<any>) => response.data
				)
			);
			const tokens = await lastValueFrom(tokens$);
			const settingsDto = settings.map((setting) => {
				if (setting.settingsName === 'access_token') {
					setting.settingsValue = tokens.access_token;
				}

				if (setting.settingsName === 'refresh_token') {
					setting.settingsValue = tokens.refresh_token;
				}

				return setting;
			}) as DeepPartial<IIntegrationSetting>;

			await this._integrationSettingService.create(settingsDto);
			return tokens;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async getHubstaffToken(integrationId): Promise<IIntegrationSetting> {
		const {
			record: integrationSetting
		} = await this._integrationSettingService.findOneOrFailByOptions({
			where: {
				integration: { id: integrationId },
				settingsName: 'access_token'
			}
		});
		return integrationSetting;
	}

	async addIntegration(
		body: ICreateIntegrationDto
	): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();
		const { client_id, client_secret, code, redirect_uri, organizationId } = body;

		const urlParams = new URLSearchParams();
		urlParams.append('client_id', client_id);
		urlParams.append('code', code);
		urlParams.append('grant_type', 'authorization_code');
		urlParams.append('redirect_uri', redirect_uri);
		urlParams.append('client_secret', client_secret);

		const tiedEntities = [];
		for await (const entity of PROJECT_TIED_ENTITIES) {
			tiedEntities.push(
				Object.assign(entity, { organizationId, tenantId })
			);
		}

		const entitySettings = DEFAULT_ENTITY_SETTINGS.map(
			(settingEntity) => {
				return Object.assign(settingEntity, {
					organizationId,
					tenantId
				});
			}
		).map((settingEntity) =>
			settingEntity.entity === IntegrationEntity.PROJECT
				? {
						...settingEntity,
						tiedEntities: tiedEntities
				  }
				: settingEntity
		) as IIntegrationEntitySetting[];

		const tokens$ = this._httpService
			.post(`${HUBSTAFF_AUTHORIZATION_URL}/access_tokens`, urlParams, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			})
			.pipe(
				switchMap(({ data }) =>
					this._integrationService.addIntegration({
						organizationId,
						tenantId,
						name: IntegrationEnum.HUBSTAFF,
						entitySettings: entitySettings,
						settings: [
							{
								settingsName: 'client_id',
								settingsValue: client_id
							},
							{
								settingsName: 'client_secret',
								settingsValue: client_secret
							},
							{
								settingsName: 'access_token',
								settingsValue: data.access_token
							},
							{
								settingsName: 'refresh_token',
								settingsValue: data.refresh_token
							}
						].map((setting) => {
							return { organizationId,  ...setting };
						})
					})
				),
				catchError((err) => {
					throw new BadRequestException(err);
				})
			);

		return await lastValueFrom(tokens$);
	}

	/*
	 * Fetch all organizations
	 */
	async fetchOrganizations({
		token
	}): Promise<IHubstaffOrganization[]> {
		const { organizations } = await this.fetchIntegration<IHubstaffOrganization[]>(
			'organizations',
			token
		);
		return organizations;
	}

	/*
	 * Fetch all organization projects
	 */
	async fetchOrganizationProjects({
		organizationId,
		token
	}): Promise<IHubstaffProject[]> {
		const { projects } = await this.fetchIntegration(
			`organizations/${organizationId}/projects?status=all`,
			token
		);
		return projects;
	}

	async syncProjects({
		integrationId,
		organizationId,
		projects
	}): Promise<IIntegrationMap[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			return await Promise.all(
				await projects.map(
					async ({ name, sourceId, billable, description }) => {
						const payload = {
							name,
							organizationId,
							public: true,
							billing: ProjectBillingEnum.RATE,
							currency: env.defaultCurrency as CurrenciesEnum,
							billable,
							description,
							tenantId
						};
						const {
							record
						} = await this._integrationMapService.findOneOrFailByOptions({
							where: {
								sourceId,
								entity: IntegrationEntity.PROJECT,
								organizationId,
								tenantId
							}
						});
						//if project already integrated then only update model/entity
						if (record) {
							await this.commandBus.execute(
								new OrganizationProjectUpdateCommand(
									Object.assign(payload, { id: record.gauzyId })
								)
							);
							return record;
						}
						const gauzyProject = await this.commandBus.execute(
							new OrganizationProjectCreateCommand(payload)
						);
						return await this.commandBus.execute(
							new IntegrationMapSyncEntityCommand({
								gauzyId: gauzyProject.id,
								integrationId,
								sourceId,
								entity: IntegrationEntity.PROJECT,
								organizationId
							})
						);
					}
				)
			)
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.PROJECT}`);
		}
	}

	async syncOrganizations({
		integrationId,
		organizations
	}): Promise<IIntegrationMap[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			return await Promise.all(
				await organizations.map(
					async (organization) => {
						const { sourceId } = organization;
						const {
							record
						} = await this._integrationMapService.findOneOrFailByOptions({
							where: {
								sourceId,
								entity: IntegrationEntity.ORGANIZATION,
								tenantId
							}
						});
						//if organization already integrated then only update model/entity
						if (record) {
							//unset sourceId before update organization
							delete organization['sourceId'];
							const { gauzyId } = record;
							await this.commandBus.execute(
								new OrganizationUpdateCommand(
									Object.assign(organization, {
										id: gauzyId,
										imageUrl: organization.imageUrl
									})
								)
							);
							return record;
						}
						const gauzyOrganization = await this.commandBus.execute(
							new OrganizationCreateCommand({
								...organization,
								imageUrl: organization.imageUrl
							})
						);
						return await this.commandBus.execute(
							new IntegrationMapSyncEntityCommand({
								gauzyId: gauzyOrganization.id,
								integrationId,
								sourceId,
								entity: IntegrationEntity.ORGANIZATION,
								organizationId: gauzyOrganization.id
							})
						);
					}
				)
			);
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.ORGANIZATION}`);
		}
	}

	async syncClients({
		integrationId,
		organizationId,
		clients
	}): Promise<IIntegrationMap[]> {
		try {
			return await Promise.all(
				await clients.map(
					async ({ name, id, emails }) => {
						const gauzyClient = await this.commandBus.execute(
							new OrganizationContactCreateCommand({
								name,
								organizationId,
								primaryEmail: emails[0],
								contactType: ContactType.CLIENT
							})
						);

						return await this.commandBus.execute(
							new IntegrationMapSyncEntityCommand({
								gauzyId: gauzyClient.id,
								integrationId,
								sourceId: id,
								entity: IntegrationEntity.CLIENT,
								organizationId
							})
						);
					}
				)
			);
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.CLIENT}`);
		}
	}

	/*
	 * Sync screenshot using timeslot
	 */
	async syncScreenshots({
		integrationId,
		screenshots,
		token,
		organizationId
	}): Promise<IIntegrationMap[]> {
		try {
			let integratedScreenshots = [];
			for await (const screenshot of screenshots) {
				const {
					id,
					time_slot,
					full_url,
					thumb_url,
					recorded_at,
					user_id
				} = screenshot;
				const employee = await this._getEmployeeByHubstaffUserId(
					user_id,
					token,
					integrationId,
					organizationId
				);
				const gauzyScreenshot = await this.commandBus.execute(
					new ScreenshotCreateCommand({
						file: full_url,
						thumb: thumb_url,
						recordedAt: recorded_at,
						activityTimestamp: time_slot,
						employeeId: employee.gauzyId,
						organizationId
					})
				);
				integratedScreenshots.push(
					await this.commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: gauzyScreenshot.id,
							integrationId,
							sourceId: id,
							entity: IntegrationEntity.SCREENSHOT,
							organizationId
						})
					)
				);
			}
			return integratedScreenshots;	
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.SCREENSHOT}`);
		}		
	}

	async syncTasks({
		integrationId,
		projectId,
		tasks,
		organizationId
	}): Promise<IIntegrationMap[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const creatorId = RequestContext.currentUserId();

			return await Promise.all(
				await tasks.map(
					async ({ summary: title, id, status, due_at }) => {
						if (!due_at) {
							due_at = new Date(
								moment().add(2, 'week').format('YYYY-MM-DD HH:mm:ss')
							);
						}
						const payload = {
							title,
							projectId,
							description: 'Hubstaff Task',
							status: status.charAt(0).toUpperCase() + status.slice(1),
							creatorId,
							dueDate: due_at,
							organizationId,
							tenantId
						};
						//if task already integrated then only update model/entity
						const {
							record
						} = await this._integrationMapService.findOneOrFailByOptions({
							where: {
								sourceId: id,
								entity: IntegrationEntity.TASK,
								organizationId,
								tenantId
							}
						});
						if (record) {
							await this.commandBus.execute(
								new TaskUpdateCommand(
									Object.assign(payload, { id: record.gauzyId })
								)
							);
							return record;
						}
						const gauzyTask = await this.commandBus.execute(
							new TaskCreateCommand(payload)
						);
						return await this.commandBus.execute(
							new IntegrationMapSyncEntityCommand({
								gauzyId: gauzyTask.id,
								integrationId,
								sourceId: id,
								entity: IntegrationEntity.TASK,
								organizationId
							})
						);
					}
				)
			);
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.TASK}`);
		}
	}

	private async _getEmployeeByHubstaffUserId(
		user_id: string,
		token: string,
		integrationId: string,
		organizationId: string
	) {
		const tenantId = RequestContext.currentTenantId();
		const { record } = await this._integrationMapService.findOneOrFailByOptions({
			where: {
				sourceId: user_id,
				entity: IntegrationEntity.EMPLOYEE,
				organizationId,
				tenantId
			}
		});

		return record
			? record
			: await this._handleEmployee({
					user_id,
					token,
					integrationId,
					organizationId
			  });
	}

	async syncTimeSlots(
		timeSlots: Array<any>,
		token: string,
		integrationId: string,
		organizationId: string
	) {
		try {
			let integratedTimeSlots = [];
			for await (const timeSlot of timeSlots) {
				const employee = await this._getEmployeeByHubstaffUserId(
					timeSlot.user_id,
					token,
					integrationId,
					organizationId
				);
				const gauzyTimeSlot = await this.commandBus.execute(
					new TimeSlotCreateCommand({
						employeeId: employee.gauzyId,
						startedAt: timeSlot.starts_at,
						keyboard: timeSlot.keyboard,
						mouse: timeSlot.mouse,
						overall: timeSlot.overall,
						duration: timeSlot.tracked,
						time_slot: timeSlot.time_slot,
						organizationId
					})
				);
				integratedTimeSlots.push(
					await this.commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: gauzyTimeSlot.id,
							integrationId,
							sourceId: timeSlot.id,
							entity: IntegrationEntity.TIME_SLOT,
							organizationId
						})
					)
				);
			}
			return integratedTimeSlots;
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.TIME_SLOT}`);
		}
	}

	async syncTimeLogs(
		timeLogs: Array<any>,
		token: string,
		integrationId: string,
		organizationId: string,
		projectId: string
	) {
		try {
			let integratedTimeLogs = [];
			const tenantId = RequestContext.currentTenantId();

			for await (const timeLog of timeLogs) {
				const employee = await this._getEmployeeByHubstaffUserId(
					timeLog.user_id,
					token,
					integrationId,
					organizationId
				);

				const { record } = await this._integrationMapService.findOneOrFailByOptions({
					where: {
						sourceId: timeLog.task_id,
						entity: IntegrationEntity.TASK,
						organizationId,
						tenantId
					}
				});
				const gauzyTimeLog = await this.commandBus.execute(
					new TimeLogCreateCommand({
						projectId,
						employeeId: employee.gauzyId,
						taskId: record ? record.gauzyId : null,
						logType: timeLog.logType,
						duration: timeLog.tracked,
						startedAt: timeLog.startedAt,
						stoppedAt: timeLog.stoppedAt,
						source: TimeLogSourceEnum.HUBSTAFF,
						organizationId,
						tenantId
					})
				);
				integratedTimeLogs.push(
					await this.commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: gauzyTimeLog.id,
							integrationId,
							sourceId: timeLog.id,
							entity: IntegrationEntity.TIME_LOG,
							organizationId
						})
					)
				);
			}
			return integratedTimeLogs;
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.TIME_LOG}`);
		}
	}

	async syncEmployee({ integrationId, user, organizationId }) {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { record } = await this._userService.findOneOrFailByOptions({
				where: {
					email: user.email,
					tenantId
				}
			});
			let employee;
			if (record) {
				employee = await this.commandBus.execute(
					new EmployeeGetCommand({ where: { userId: record.id } })
				);
			} else {
				const [role, organization] = await Promise.all([
					await this._roleService.findOneByOptions({
						where: {
							name: RolesEnum.EMPLOYEE,
							tenantId
						}
					}),
					await this._organizationService.findOneByOptions({
						where: {
							id: organizationId,
							tenantId
						}
					})
				]);
				const [firstName, lastName] = user.name.split(' ');
				const isActive = user.status === 'active' ? true : false;
				employee = await this.commandBus.execute(
					new EmployeeCreateCommand({
						user: {
							email: user.email,
							firstName,
							lastName,
							role,
							tags: null,
							tenantId,
							preferredComponentLayout: ComponentLayoutStyleEnum.TABLE,
							thirdPartyId: user.id
						},
						password: env.defaultIntegratedUserPass,
						organization,
						startedWorkOn: new Date(
							moment().format('YYYY-MM-DD HH:mm:ss')
						),
						isActive,
						tenantId
					})
				);
			}
			return await this.commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: employee.id,
					integrationId,
					sourceId: user.id,
					entity: IntegrationEntity.EMPLOYEE,
					organizationId
				})
			);
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.EMPLOYEE}`);
		}
	}

	private async _handleEmployee({
		user_id,
		integrationId,
		token,
		organizationId
	}) {
		try {
			const { user } = await this.fetchIntegration(
				`users/${user_id}`,
				token
			);
			return await this.syncEmployee({
				integrationId,
				user,
				organizationId
			});	
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t handle ${IntegrationEntity.EMPLOYEE}`);
		}
	}

	private async _handleProjects(
		sourceId: string,
		integrationId: string,
		gauzyId: string,
		token: string
	) {
		try {
			const { projects } = await this.fetchIntegration(
				`organizations/${sourceId}/projects?status=all`,
				token
			);
			const projectMap = projects.map(({ name, id, billable, description }) => ({
					name,
					sourceId: id,
					billable,
					description
				})
			);
			return await this.syncProjects({
				integrationId,
				organizationId: gauzyId,
				projects: projectMap
			});
		} catch (error) {
			throw new BadRequestException(`Can\'t handle ${IntegrationEntity.PROJECT}`);
		}
	}

	private async _handleClients(
		sourceId: string,
		integrationId: string,
		gauzyId: string,
		token: string
	) {
		try {
			const { clients } = await this.fetchIntegration(
				`organizations/${sourceId}/clients?status=active`,
				token
			);
			return await this.syncClients({
				integrationId,
				organizationId: gauzyId,
				clients
			});	
		} catch (error) {
			throw new BadRequestException(`Can\'t handle ${IntegrationEntity.CLIENT}`);
		}
	}

	private async _handleTasks(projectsMap, integrationId, token, gauzyId) {
		try {
			const tasksMap = await Promise.all(
				projectsMap.map(async (project) => {
					const { tasks } = await this.fetchIntegration(
						`projects/${project.sourceId}/tasks`,
						token
					);
					return await this.syncTasks({
						integrationId,
						tasks,
						projectId: project.gauzyId,
						organizationId: gauzyId
					});
				})
			);
			return tasksMap;
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t handle ${IntegrationEntity.TASK}`);
		}
	}

	/*
	 * Sync with database urls activities
	 */
	async syncUrlActivities({
		integrationId,
		projectId,
		activities,
		token,
		organizationId
	}): Promise<IIntegrationMap[]> {
		try {
			const tenantId = RequestContext.currentTenantId();

			let integrationMaps = [];
			for await (const activity of activities) {
				const { id, site, tracked, user_id, time_slot, task_id } = activity;
				const { record } = await this._integrationMapService.findOneOrFailByOptions({
					where: {
						sourceId: id,
						entity: IntegrationEntity.ACTIVITY,
						organizationId
					}
				});
				//if activity already integrated then no need to create new one
				if (record) {
					return record;
				}

				const employee = await this._getEmployeeByHubstaffUserId(
					user_id,
					token,
					integrationId,
					organizationId
				);
				const time = moment(time_slot).format('HH:mm:ss');
				const date = moment(time_slot).format('YYYY-MM-DD');

				const { record: task } = await this._integrationMapService.findOneOrFailByOptions({
					where: {
						sourceId: task_id,
						entity: IntegrationEntity.TASK,
						organizationId,
						tenantId
					}
				});

				const gauzyActivity = await this.commandBus.execute(
					new ActivityCreateCommand({
						title: site,
						duration: tracked,
						type: ActivityType.URL,
						date,
						time,
						projectId,
						employeeId: employee.gauzyId,
						taskId: task ? task.gauzyId : null,
						organizationId,
						activityTimestamp: time_slot
					})
				);
				integrationMaps.push(
					await this.commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: gauzyActivity.id,
							integrationId,
							sourceId: id,
							entity: IntegrationEntity.ACTIVITY,
							organizationId
						})
					)
				);
			}
			return integrationMaps;
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync URL ${IntegrationEntity.ACTIVITY}`);
		}
	}

	/*
	 * auto sync for urls activities for seperate project
	 */
	private async _handleUrlActivities(
		projectsMap: IIntegrationMap[],
		integrationId: string,
		token: string,
		organizationId: string,
		dateRange: IDateRangeActivityFilter
	) {
		try {
			const start = moment(dateRange.start).format('YYYY-MM-DD');
			const end = moment(dateRange.end).format('YYYY-MM-DD');
			const pageLimit = 500;

			const urlActivitiesMapped = await Promise.all(
				projectsMap.map(async (project) => {
					const { gauzyId, sourceId } = project;
					const syncedActivities = {
						urlActivities: []
					};

					let stillRecordsAvailable = true;
					let nextPageStartId = null;

					while (stillRecordsAvailable) {
						let url = `projects/${sourceId}/url_activities?page_limit=${pageLimit}&time_slot[start]=${start}&time_slot[stop]=${end}`;
						if (nextPageStartId) {
							url += `&page_start_id=${nextPageStartId}`;
						}

						const {
							urls,
							pagination = {}
						} = await this.fetchIntegration(url, token);

						if (
							pagination &&
							pagination.hasOwnProperty('next_page_start_id')
						) {
							const { next_page_start_id } = pagination;
							nextPageStartId = next_page_start_id;
							stillRecordsAvailable = true;
						} else {
							nextPageStartId = null;
							stillRecordsAvailable = false;
						}
						syncedActivities.urlActivities.push(urls);
					}

					const activities = [].concat.apply(
						[],
						syncedActivities.urlActivities
					);
					return await this.syncUrlActivities({
						integrationId,
						projectId: gauzyId,
						activities,
						token,
						organizationId
					});
				})
			);
			return urlActivitiesMapped;
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t handle URL ${IntegrationEntity.ACTIVITY}`);
		}
	}

	/*
	 * Sync with database application activities
	 */
	async syncAppActivities({
		integrationId,
		projectId,
		activities,
		token,
		organizationId
	}): Promise<IIntegrationMap[]> {
		try {
			const tenantId = RequestContext.currentTenantId();

			let integratedAppActivities = [];
			for await (const activity of activities) {
				console.log(activity);
				const { id, name, tracked, user_id, time_slot, task_id } = activity;
				const { record } = await this._integrationMapService.findOneOrFailByOptions({
					where: {
						sourceId: id,
						entity: IntegrationEntity.ACTIVITY,
						organizationId
					}
				});
				//if activity already integrated then no need to create new one
				if (record) {
					return record;
				}

				const employee = await this._getEmployeeByHubstaffUserId(
					user_id,
					token,
					integrationId,
					organizationId
				);
				const time = moment(time_slot).format('HH:mm:ss');
				const date = moment(time_slot).format('YYYY-MM-DD');
				
				const { record: task } = await this._integrationMapService.findOneOrFailByOptions({
					where: {
						sourceId: task_id,
						entity: IntegrationEntity.TASK,
						organizationId,
						tenantId
					}
				});

				const gauzyActivity = await this.commandBus.execute(
					new ActivityCreateCommand({
						title: name,
						duration: tracked,
						type: ActivityType.APP,
						time,
						date,
						projectId,
						employeeId: employee.gauzyId,
						taskId: task ? task.gauzyId : null,
						organizationId,
						activityTimestamp: time_slot
					})
				);
				integratedAppActivities.push(
					await this.commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: gauzyActivity.id,
							integrationId,
							sourceId: id,
							entity: IntegrationEntity.ACTIVITY,
							organizationId
						})
					)
				);
			}
			return integratedAppActivities;
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t sync APP ${IntegrationEntity.ACTIVITY}`);
		}
	}

	/*
	 * auto sync for application activities for seperate project
	 */
	private async _handleAppActivities(
		projectsMap: IIntegrationMap[],
		integrationId: string,
		token: string,
		organizationId: string,
		dateRange: IDateRangeActivityFilter
	) {
		try {
			const start = moment(dateRange.start).format('YYYY-MM-DD');
			const end = moment(dateRange.end).format('YYYY-MM-DD');
			const pageLimit = 500;

			const appActivitiesMapped = await Promise.all(
				projectsMap.map(async (project) => {
					const { gauzyId, sourceId } = project;
					const syncedActivities = {
						applicationActivities: []
					};

					let stillRecordsAvailable = true;
					let nextPageStartId = null;

					while (stillRecordsAvailable) {
						let url = `projects/${sourceId}/application_activities?page_limit=${pageLimit}&time_slot[start]=${start}&time_slot[stop]=${end}`;
						if (nextPageStartId) {
							url += `&page_start_id=${nextPageStartId}`;
						}

						const {
							applications,
							pagination = {}
						} = await this.fetchIntegration(url, token);

						if (
							pagination &&
							pagination.hasOwnProperty('next_page_start_id')
						) {
							const { next_page_start_id } = pagination;
							nextPageStartId = next_page_start_id;
							stillRecordsAvailable = true;
						} else {
							nextPageStartId = null;
							stillRecordsAvailable = false;
						}
						syncedActivities.applicationActivities.push(
							applications
						);
					}

					const activities = [].concat.apply(
						[],
						syncedActivities.applicationActivities
					);
					return await this.syncAppActivities({
						integrationId,
						projectId: gauzyId,
						activities,
						token,
						organizationId
					});
				})
			);
			return appActivitiesMapped;
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t handle APP ${IntegrationEntity.ACTIVITY}`);
		}
	}

	private async _handleActivities(
		projectsMap: IIntegrationMap[],
		integrationId: string,
		token: string,
		organizationId: string,
		dateRange: IDateRangeActivityFilter
	) {
		try {
			const start = moment(dateRange.start).format('YYYY-MM-DD');
			const end = moment(dateRange.end).format('YYYY-MM-DD');
						
			const syncedActivities = {
				integratedTimeLogs: [],
				integratedTimeSlots: []
			};

			for await (const project of projectsMap) {
				const { activities } = await this.fetchIntegration(
					`projects/${project.sourceId}/activities?time_slot[start]=${start}&time_slot[stop]=${end}`,
					token
				);
				if (isEmpty(activities)) {
					continue;
				}

				const timeLogs = this.formatLogsFromSlots(activities);
				const integratedTimeLogs = await this.syncTimeLogs(
					timeLogs,
					token,
					integrationId,
					organizationId,
					project.gauzyId
				);

				const integratedTimeSlots = await this.syncTimeSlots(
					activities,
					token,
					integrationId,
					organizationId
				);

				syncedActivities.integratedTimeLogs = syncedActivities.integratedTimeLogs.concat(
					integratedTimeLogs
				);
				syncedActivities.integratedTimeSlots = syncedActivities.integratedTimeSlots.concat(
					integratedTimeSlots
				);
			}
			return syncedActivities;
		} catch (error) {
			console.log(error);
			if (error instanceof HttpException) {
				throw new HttpException(error.getResponse(), error.getStatus());
			}
			throw new BadRequestException(error, `Can\'t handle ${IntegrationEntity.ACTIVITY}`);
		}
	}

	/**
	 * Sync activities screenshots
	 */
	private async _handleScreenshots(
		projectsMap: IIntegrationMap[],
		integrationId: string,
		token: string,
		organizationId: string,
		dateRange: IDateRangeActivityFilter
	) {
		try {
			
			const start = moment(dateRange.start).format('YYYY-MM-DD');
			const end = moment(dateRange.end).format('YYYY-MM-DD');
			const pageLimit = 500;

			return await Promise.all(
				projectsMap.map(async (project) => {
					const { sourceId } = project;
					const syncedActivities = {
						screenshots: []
					};

					let stillRecordsAvailable = true;
					let nextPageStartId = null;

					while (stillRecordsAvailable) {
						let url = `projects/${sourceId}/screenshots?page_limit=${pageLimit}&time_slot[start]=${start}&time_slot[stop]=${end}`;
						if (nextPageStartId) {
							url += `&page_start_id=${nextPageStartId}`;
						}

						const {
							screenshots: fetchScreenshots,
							pagination = {}
						} = await this.fetchIntegration(url, token);

						if (
							pagination &&
							pagination.hasOwnProperty('next_page_start_id')
						) {
							const { next_page_start_id } = pagination;
							nextPageStartId = next_page_start_id;
							stillRecordsAvailable = true;
						} else {
							nextPageStartId = null;
							stillRecordsAvailable = false;
						}

						syncedActivities.screenshots.push(fetchScreenshots);
					}

					const screenshots = [].concat.apply(
						[],
						syncedActivities.screenshots
					);
					return await this.syncScreenshots({
						integrationId,
						screenshots,
						token,
						organizationId
					});
				})
			);
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error, `Can\'t handle activities ${IntegrationEntity.SCREENSHOT}`);
		}
	}

	async autoSync({
		integrationId,
		entitiesToSync,
		gauzyId,
		sourceId,
		token,
		dateRange
	}) {
		// entities have depended entity. eg to fetch Task we need Project id or Org id, because our Task entity is related to Project, the relation here is same, we need project id to fetch Tasks
		const integratedMaps = await Promise.all(
			entitiesToSync.map(async (setting) => {
				switch (setting.entity) {
					case IntegrationEntity.PROJECT:
						let tasks, activities, screenshots;
						const projectsMap: IIntegrationMap[] = await this._handleProjects(
							sourceId,
							integrationId,
							gauzyId,
							token
						);

						/**
						 * Tasks Sync
						 */
						const taskSetting: IIntegrationEntitySetting = setting.tiedEntities.find(
							(res) => res.entity === IntegrationEntity.TASK
						);
						if (isObject(taskSetting) && taskSetting.sync) {
							tasks = await this._handleTasks(
								projectsMap,
								integrationId,
								token,
								gauzyId
							);
						}

						/**
						 * Activity Sync
						 */
						const activitySetting: IIntegrationEntitySetting = setting.tiedEntities.find(
							(res) => res.entity === IntegrationEntity.ACTIVITY
						);
						if (isObject(activitySetting) && activitySetting.sync) {
							activities = await this._handleActivities(
								projectsMap,
								integrationId,
								token,
								gauzyId,
								dateRange
							);
							activities.application = await this._handleAppActivities(
								projectsMap,
								integrationId,
								token,
								gauzyId,
								dateRange
							);
							activities.urls = await this._handleUrlActivities(
								projectsMap,
								integrationId,
								token,
								gauzyId,
								dateRange
							);
						}

						/**
						 * Activity Screenshot Sync
						 */
						const screenshotSetting: IIntegrationEntitySetting = setting.tiedEntities.find(
							(res) => res.entity === IntegrationEntity.SCREENSHOT
						);
						if (isObject(screenshotSetting) && screenshotSetting.sync) {
							screenshots = await this._handleScreenshots(
								projectsMap,
								integrationId,
								token,
								gauzyId,
								dateRange
							);
						}
						return { tasks, projectsMap, activities, screenshots };
					case IntegrationEntity.CLIENT:
						const clients = await this._handleClients(
							sourceId,
							integrationId,
							gauzyId,
							token
						);
						return { clients };
				}
			})
		);
		return integratedMaps;
	}

	formatLogsFromSlots(slots) {
		if (isEmpty(slots)) {
			return;
		}

		const range = [];
		let i = 0;
		while (slots[i]) {

			const start = moment(slots[i].starts_at);
			const end = moment(slots[i].starts_at).add(slots[i].input_tracked, 'seconds');

			range.push({
				start: start.toDate(),
				end: end.toDate()
			});
			i++;
		}

		const timeLogs = [];
		const dates: IDateRange[] = mergeOverlappingDateRanges(range);

		if (isNotEmpty(dates)) {
			dates.forEach(({ start, end}) => {
				let i = 0;
				const timeSlots = new Array();

				while (slots[i]) {
					const slotTime = moment(slots[i].starts_at);
					if (slotTime.isBetween(moment(start), moment(end), null, '[]')) {
						timeSlots.push(slots[i]);
					}
					i++;
				}

				const [ activity ] = this.getLogsActivityFromSlots(timeSlots);
				timeLogs.push({
					startedAt: start,
					stoppedAt: end,
					timeSlots,
					...activity
				});
			});
		}

		return timeLogs;
	}

	getLogsActivityFromSlots(timeSlots): any {
		const timeLogs = timeSlots.reduce((prev, current) => {
			const prevLog = prev[current.date];
			return {
				...prev,
				[current.date]: prevLog
					? {
							id: current.id,
							date: current.date,
							user_id: prevLog.user_id,
							project_id: prevLog.project_id,
							task_id: prevLog.task_id,
							keyboard: (prevLog.keyboard += current.keyboard),
							mouse: (prevLog.mouse += current.mouse),
							overall: (prevLog.overall += current.overall),
							tracked: (prevLog.tracked += current.tracked),
							// this will take the last chunk(slot), maybe we should allow percentage for this, as one time log can have both manual and tracked
							logType:
								current.client === 'windows'
									? TimeLogType.TRACKED
									: TimeLogType.MANUAL
					  }
					: {
							id: current.id,
							date: current.date,
							user_id: current.user_id,
							project_id: current.project_id,
							task_id: current.task_id,
							keyboard: current.keyboard,
							mouse: current.mouse,
							overall: current.overall,
							tracked: current.tracked,
							logType:
								current.client === 'windows'
									? TimeLogType.TRACKED
									: TimeLogType.MANUAL
					  }
			};
		}, {});
		return Object.values(timeLogs);
	}
}
