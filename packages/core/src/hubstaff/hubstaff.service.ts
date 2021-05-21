import {
	Injectable,
	HttpService,
	BadRequestException,
	HttpStatus,
	UnauthorizedException
} from '@nestjs/common';
import { map, catchError, switchMap } from 'rxjs/operators';
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
	IHubstaffProject
} from '@gauzy/contracts';
import { IntegrationTenantService } from '../integration-tenant/integration-tenant.service';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import { IntegrationEntitySettingService } from '../integration-entity-setting/integration-entity-setting.service';
import {
	DEFAULT_ENTITY_SETTINGS,
	PROJECT_TIED_ENTITIES
} from '@gauzy/integration-hubstaff';
import {
	OrganizationCreateCommand,
	OrganizationUpdateCommand
} from '../organization/commands';
import { CommandBus } from '@nestjs/cqrs';
import { OrganizationContactCreateCommand } from '../organization-contact/commands/organization-contact-create.command';
import { TaskCreateCommand } from '../tasks/commands';
import { IntegrationEntitySettingTiedEntityService } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.service';
import { DeepPartial } from 'typeorm';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';
import { EmployeeCreateCommand } from '../employee/commands';
import { RoleService } from '../role/role.service';
import { OrganizationService } from '../organization/organization.service';
import { UserService } from '../user/user.service';
import { EmployeeGetCommand } from '../employee/commands/employee.get.command';
import * as moment from 'moment';
import {
	TimeSlotCreateCommand,
	TimesheetGetCommand,
	TimesheetCreateCommand,
	ScreenshotCreateCommand,
	ActivityCreateCommand
} from '../timesheet/commands';
import { environment } from '@gauzy/config';
import { getDummyImage } from '../core';
import { TimeLogCreateCommand } from '../timesheet/time-log/commands/time-log-create.command';
import { RequestContext } from '../core/context';
import { OrganizationProjectCreateCommand } from '../organization-projects/commands/organization-project.create.command';
import { OrganizationProjectUpdateCommand } from '../organization-projects/commands/organization-project.update.command';
import { TaskUpdateCommand } from '../tasks/commands/task-update.command';
import { environment as env } from '@gauzy/config';

@Injectable()
export class HubstaffService {
	constructor(
		private _httpService: HttpService,
		private _integrationService: IntegrationTenantService,
		private _integrationSettingService: IntegrationSettingService,
		private _integrationMapService: IntegrationMapService,
		private _integrationEntitySettingService: IntegrationEntitySettingService,
		private _integrationEntitySettingTiedEntityService: IntegrationEntitySettingTiedEntityService,
		private _roleService: RoleService,
		private _organizationService: OrganizationService,
		private _userService: UserService,
		private readonly commandBus: CommandBus
	) {}

	async fetchIntegration(url, token): Promise<any> {
		const headers = {
			Authorization: `Bearer ${token}`
		};
		try {
			return await this._httpService
				.get(url, { headers })
				.pipe(map((response) => response.data))
				.toPromise();
		} catch (error) {
			if (error.response.status === HttpStatus.UNAUTHORIZED) {
				throw new UnauthorizedException();
			}
			throw new BadRequestException(error);
		}
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
			const tokens = await this._httpService
				.post('https://account.hubstaff.com/access_tokens', urlParams, {
					headers
				})
				.pipe(map((response) => response.data))
				.toPromise();

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

	async getHubstaffToken(integrationId): Promise<string> {
		const {
			record: integrationSetting
		} = await this._integrationSettingService.findOneOrFail({
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
		const headers = {
			'Content-Type': 'application/x-www-form-urlencoded'
		};
		const {
			client_id,
			client_secret,
			code,
			redirect_uri,
			organizationId
		} = body;
		const urlParams = new URLSearchParams();
		urlParams.append('client_id', client_id);
		urlParams.append('code', code);
		urlParams.append('grant_type', 'authorization_code');
		urlParams.append('redirect_uri', redirect_uri);
		urlParams.append('client_secret', client_secret);

		const tenantId = RequestContext.currentTenantId();
		const tiedEntities = [];
		for await (const entity of PROJECT_TIED_ENTITIES) {
			const create = await this._integrationEntitySettingTiedEntityService.create(
				Object.assign(entity, { organizationId, tenantId })
			);
			tiedEntities.push(create);
		}

		const settingsForEntities = DEFAULT_ENTITY_SETTINGS.map(
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
		) as DeepPartial<IntegrationEntitySetting>;

		const entitySettings = await this._integrationEntitySettingService.create(
			settingsForEntities
		);
		return this._httpService
			.post('https://account.hubstaff.com/access_tokens', urlParams, {
				headers
			})
			.pipe(
				switchMap(({ data }) =>
					this._integrationService.addIntegration({
						organizationId,
						tenantId,
						name: IntegrationEnum.HUBSTAFF,
						entitySettings,
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
							return { organizationId, ...setting };
						})
					})
				),
				catchError((err) => {
					throw new BadRequestException(err);
				})
			)
			.toPromise();
	}

	/*
	 * Fetch all organizations
	 */
	async fetchOrganizations({
		integrationId,
		token
	}): Promise<IHubstaffOrganization[]> {
		const { organizations } = await this.fetchIntegration(
			'https://api.hubstaff.com/v2/organizations',
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
			`https://api.hubstaff.com/v2/organizations/${organizationId}/projects?status=all`,
			token
		);
		return projects;
	}

	async syncProjects({
		integrationId,
		organizationId,
		projects
	}): Promise<IIntegrationMap[]> {
		const tenantId = RequestContext.currentTenantId();
		const integrationMaps = await projects.map(
			async ({ name, sourceId, billable, description }) => {
				const payload = {
					name,
					organizationId,
					public: true,
					billing: ProjectBillingEnum.RATE,
					currency: env.defaultCurrency as CurrenciesEnum,
					billable,
					description
				};
				const {
					record
				} = await this._integrationMapService.findOneOrFail({
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
				return await this._integrationMapService.create({
					gauzyId: gauzyProject.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.PROJECT,
					organizationId
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	async syncOrganizations({
		integrationId,
		organizations
	}): Promise<IIntegrationMap[]> {
		const { tenantId } = RequestContext.currentUser();
		const integrationMaps = await organizations.map(
			async (organization) => {
				const { sourceId } = organization;
				const {
					record
				} = await this._integrationMapService.findOneOrFail({
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
								imageUrl:
									organization.imageUrl ||
									getDummyImage(
										330,
										300,
										organization.name
											.charAt(0)
											.toUpperCase()
									)
							})
						)
					);
					return record;
				}
				const gauzyOrganization = await this.commandBus.execute(
					new OrganizationCreateCommand({
						...organization,
						imageUrl:
							organization.imageUrl ||
							getDummyImage(
								330,
								300,
								organization.name.charAt(0).toUpperCase()
							)
					})
				);
				return await this._integrationMapService.create({
					gauzyId: gauzyOrganization.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.ORGANIZATION,
					organizationId: gauzyOrganization.id
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	async syncClients({
		integrationId,
		organizationId,
		clients
	}): Promise<IIntegrationMap[]> {
		const integrationMaps = await clients.map(
			async ({ name, id, emails }) => {
				const gauzyClient = await this.commandBus.execute(
					new OrganizationContactCreateCommand({
						name,
						organizationId,
						primaryEmail: emails[0],
						contactType: ContactType.CLIENT
					})
				);

				return await this._integrationMapService.create({
					gauzyId: gauzyClient.id,
					integrationId,
					sourceId: id,
					entity: IntegrationEntity.CLIENT,
					organizationId
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	/*
	 * Sync screenshot using timeslot
	 */
	async syncScreenshots({
		integrationId,
		projectId,
		screenshots,
		token,
		organizationId
	}): Promise<IIntegrationMap[]> {
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
			const integratedScreenshot = await this._integrationMapService.create(
				{
					gauzyId: gauzyScreenshot.id,
					integrationId,
					sourceId: id,
					entity: IntegrationEntity.SCREENSHOT,
					organizationId
				}
			);
			integratedScreenshots = integratedScreenshots.concat(
				integratedScreenshot
			);
		}
		return integratedScreenshots;
	}

	async syncTasks({
		integrationId,
		projectId,
		tasks,
		organizationId
	}): Promise<IIntegrationMap[]> {
		const { id: creatorId, tenantId } = RequestContext.currentUser();
		const integrationMaps = await tasks.map(
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
				} = await this._integrationMapService.findOneOrFail({
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
				return await this._integrationMapService.create({
					gauzyId: gauzyTask.id,
					integrationId,
					sourceId: id,
					entity: IntegrationEntity.TASK,
					organizationId
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	private async _getEmployeeByHubstaffUserId(
		user_id,
		token,
		integrationId,
		organizationId
	) {
		const tenantId = RequestContext.currentTenantId();
		const { record } = await this._integrationMapService.findOneOrFail({
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

	async syncTimeSlots(timeSlots, token, integrationId, organizationId) {
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

			const integratedSlots = await this._integrationMapService.create({
				gauzyId: gauzyTimeSlot.id,
				integrationId,
				sourceId: timeSlot.id,
				entity: IntegrationEntity.TIME_SLOT,
				organizationId
			});

			integratedTimeSlots = integratedTimeSlots.concat(integratedSlots);
		}
		return integratedTimeSlots;
	}

	async syncTimeLogs(
		timeLogs,
		token,
		integrationId,
		organizationId,
		projectId,
		start,
		end
	) {
		let integratedTimeLogs = [];
		const tenantId = RequestContext.currentRequest();
		for await (const timeLog of timeLogs) {
			const employee = await this._getEmployeeByHubstaffUserId(
				timeLog.user_id,
				token,
				integrationId,
				organizationId
			);

			let timesheet = await this.commandBus.execute(
				new TimesheetGetCommand({
					where: {
						employeeId: employee.gauzyId,
						organizationId,
						tenantId
					}
				})
			);

			if (!timesheet) {
				timesheet = await this.commandBus.execute(
					new TimesheetCreateCommand({
						startedAt: start,
						stoppedAt: end,
						employeeId: employee.gauzyId,
						// to be get from formatedLogs, filtered by user and get totals
						mouse: 0,
						keyboard: 0,
						duration: 0,
						organizationId
					})
				);
			}

			const gauzyTimeLog = await this.commandBus.execute(
				new TimeLogCreateCommand({
					projectId,
					employeeId: employee.gauzyId,
					logType: timeLog.logType,
					duration: timeLog.tracked,
					startedAt: timeLog.starts_at,
					timesheetId: timesheet.id,
					source: TimeLogSourceEnum.HUBSTAFF,
					organizationId
				})
			);

			const integratedLogs = await this._integrationMapService.create({
				gauzyId: gauzyTimeLog.id,
				integrationId,
				sourceId: timeLog.id,
				entity: IntegrationEntity.TIME_LOG,
				organizationId
			});
			integratedTimeLogs = integratedTimeLogs.concat(integratedLogs);
		}

		return integratedTimeLogs;
	}

	async syncEmployee({ integrationId, user, organizationId }) {
		const tenantId = RequestContext.currentTenantId();
		const { record } = await this._userService.findOneOrFail({
			where: { email: user.email }
		});
		let employee;
		if (record) {
			employee = await this.commandBus.execute(
				new EmployeeGetCommand({ where: { userId: record.id } })
			);
		} else {
			const [role, organization] = await Promise.all([
				await this._roleService.findOne({
					where: { name: RolesEnum.EMPLOYEE }
				}),
				await this._organizationService.findOne({
					where: { id: organizationId }
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
						thirdPartyId: user.id
					},
					password: environment.defaultHubstaffUserPass,
					organization,
					startedWorkOn: new Date(
						moment().format('YYYY-MM-DD HH:mm:ss')
					),
					isActive
				})
			);
		}
		return await this._integrationMapService.create({
			gauzyId: employee.id,
			integrationId,
			sourceId: user.id,
			entity: IntegrationEntity.EMPLOYEE,
			organizationId
		});
	}

	private async _handleEmployee({
		user_id,
		integrationId,
		token,
		organizationId
	}) {
		const { user } = await this.fetchIntegration(
			`https://api.hubstaff.com/v2/users/${user_id}`,
			token
		);

		return await this.syncEmployee({
			integrationId,
			user,
			organizationId
		});
	}

	private async _handleProjects(sourceId, integrationId, gauzyId, token) {
		try {
			const { projects } = await this.fetchIntegration(
				`https://api.hubstaff.com/v2/organizations/${sourceId}/projects?status=all`,
				token
			);
			const projectMap = projects.map(
				({ name, id, billable, description }) => ({
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
			throw new BadRequestException('Cannot sync Projects');
		}
	}

	private async _handleClients(sourceId, integrationId, gauzyId, token) {
		const { clients } = await this.fetchIntegration(
			`https://api.hubstaff.com/v2/organizations/${sourceId}/clients?status=active`,
			token
		);

		return await this.syncClients({
			integrationId,
			organizationId: gauzyId,
			clients
		});
	}

	private async _handleTasks(projectsMap, integrationId, token, gauzyId) {
		const tasksMap = await Promise.all(
			projectsMap.map(async (project) => {
				const { tasks } = await this.fetchIntegration(
					`https://api.hubstaff.com/v2/projects/${project.sourceId}/tasks`,
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
		let integrationMaps = [];
		for await (const activity of activities) {
			const { id, site, tracked, user_id } = activity;
			let { date } = activity;

			const { record } = await this._integrationMapService.findOneOrFail({
				where: {
					sourceId: id,
					entity: IntegrationEntity.ACTIVITY
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
			const time = moment(date).format('HH:mm:ss');
			date = moment(date).format('YYYY-MM-DD');

			const gauzyActivity = await this.commandBus.execute(
				new ActivityCreateCommand({
					title: site,
					duration: tracked,
					type: 'URL',
					date,
					time,
					projectId,
					employeeId: employee.gauzyId
				})
			);
			const integrationMap = await this._integrationMapService.create({
				gauzyId: gauzyActivity.id,
				integrationId,
				sourceId: id,
				entity: IntegrationEntity.ACTIVITY
			});
			integrationMaps = integrationMaps.concat(integrationMap);
		}

		return integrationMaps;
	}

	/*
	 * auto sync for urls activities for seperate project
	 */
	private async _handleUrlActivities(
		projectsMap,
		integrationId,
		token,
		organizationId,
		dateRange
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
						let url = `https://api.hubstaff.com/v2/projects/${sourceId}/url_activities?page_limit=${pageLimit}&time_slot[start]=${start}&time_slot[stop]=${end}`;
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
			throw new BadRequestException('Cannot sync url activities');
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
		let integratedAppActivities = [];
		for await (const activity of activities) {
			const { id, name, tracked, user_id } = activity;
			let { date } = activity;

			const { record } = await this._integrationMapService.findOneOrFail({
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
			const time = moment(date).format('HH:mm:ss');
			date = moment(date).format('YYYY-MM-DD');

			const gauzyActivity = await this.commandBus.execute(
				new ActivityCreateCommand({
					title: name,
					duration: tracked,
					type: 'APP',
					time,
					date,
					projectId,
					employeeId: employee.gauzyId,
					organizationId
				})
			);
			const integartedActivity = await this._integrationMapService.create(
				{
					gauzyId: gauzyActivity.id,
					integrationId,
					sourceId: id,
					entity: IntegrationEntity.ACTIVITY,
					organizationId
				}
			);
			integratedAppActivities = integratedAppActivities.concat(
				integartedActivity
			);
		}

		return integratedAppActivities;
	}

	/*
	 * auto sync for application activities for seperate project
	 */
	private async _handleAppActivities(
		projectsMap,
		integrationId,
		token,
		organizationId,
		dateRange
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
						let url = `https://api.hubstaff.com/v2/projects/${sourceId}/application_activities?page_limit=${pageLimit}&time_slot[start]=${start}&time_slot[stop]=${end}`;
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
			throw new BadRequestException('Cannot sync application activities');
		}
	}

	private async _handleActivities(
		projectsMap,
		integrationId,
		token,
		organizationId,
		dateRange
	) {
		const start = moment(dateRange.start).format('YYYY-MM-DD');
		const end = moment(dateRange.end).format('YYYY-MM-DD');
		const syncedActivities = {
			integratedTimeLogs: [],
			integratedTimeSlots: []
		};

		for await (const project of projectsMap) {
			const timeSlots = await this.fetchIntegration(
				`https://api.hubstaff.com/v2/projects/${project.sourceId}/activities?time_slot[start]=${start}&time_slot[stop]=${end}`,
				token
			);

			const integratedTimeLogs = await this.syncTimeLogs(
				this.formatedLogsFromSlots(timeSlots.activities),
				token,
				integrationId,
				organizationId,
				project.gauzyId,
				start,
				end
			);

			const integratedTimeSlots = await this.syncTimeSlots(
				timeSlots.activities,
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
	}

	/**
	 * Sync activities screenshots
	 */
	private async _handleScreenshots(
		projectsMap,
		integrationId,
		token,
		organizationId,
		dateRange
	) {
		try {
			const start = moment(dateRange.start).format('YYYY-MM-DD');
			const end = moment(dateRange.end).format('YYYY-MM-DD');
			const pageLimit = 500;

			const screenshotsMapped = await Promise.all(
				projectsMap.map(async (project) => {
					const { gauzyId, sourceId } = project;
					const syncedActivities = {
						screenshots: []
					};

					let stillRecordsAvailable = true;
					let nextPageStartId = null;

					while (stillRecordsAvailable) {
						let url = `https://api.hubstaff.com/v2/projects/${sourceId}/screenshots?page_limit=${pageLimit}&time_slot[start]=${start}&time_slot[stop]=${end}`;
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
						projectId: gauzyId,
						screenshots,
						token,
						organizationId
					});
				})
			);
			return screenshotsMapped;
		} catch (error) {
			throw new BadRequestException('Cannot sync activities screenshots');
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
						const projectsMap = await this._handleProjects(
							sourceId,
							integrationId,
							gauzyId,
							token
						);
						const taskSetting = setting.tiedEntities.find(
							(res) => res.entity === IntegrationEntity.TASK
						);

						const activitySetting = setting.tiedEntities.find(
							(res) => res.entity === IntegrationEntity.ACTIVITY
						);

						const screenshotSetting = setting.tiedEntities.find(
							(res) => res.entity === IntegrationEntity.SCREENSHOT
						);

						if (
							typeof taskSetting === 'object' &&
							taskSetting.sync
						) {
							tasks = await this._handleTasks(
								projectsMap,
								integrationId,
								token,
								gauzyId
							);
						}

						if (
							typeof activitySetting === 'object' &&
							activitySetting.sync
						) {
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

						if (
							typeof screenshotSetting === 'object' &&
							screenshotSetting.sync
						) {
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

	formatedLogsFromSlots(timeSlots) {
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
							starts_at: moment
								.utc(prevLog.starts_at)
								.format('YYYY-MM-DD HH:mm:ss'),
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
							starts_at: moment
								.utc(current.starts_at)
								.format('YYYY-MM-DD HH:mm:ss'),
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
