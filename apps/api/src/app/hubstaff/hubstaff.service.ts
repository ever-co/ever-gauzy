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
	IIntegration,
	IntegrationEnum,
	IntegrationEntity,
	IIntegrationMap,
	IIntegrationSetting,
	RolesEnum,
	TimeLogType
} from '@gauzy/models';
import { IntegrationService } from '../integration/integration.service';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { OrganizationProjectsService } from '../organization-projects/organization-projects.service';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import { IntegrationEntitySettingService } from '../integration-entity-setting/integration-entity-setting.service';
import {
	DEFAULT_ENTITY_SETTINGS,
	PROJECT_TIED_ENTITIES
} from './hubstaff-entity-settings';
import { OrganizationCreateCommand } from '../organization/commands';
import { CommandBus } from '@nestjs/cqrs';
import { OrganizationClientsCreateCommand } from '../organization-clients/commands/organization-clients-create.commant';
import { TaskCreateCommand } from '../tasks/commands';
import { IntegrationEntitySettingTiedEntityService } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entitiy.service';
import { DeepPartial } from 'typeorm';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';
import { ActivityCreateCommand } from '../timesheet/commands/activity-create.command';
import { EmployeeCreateCommand } from '../employee/commands';
import { RoleService } from '../role/role.service';
import { OrganizationService } from '../organization/organization.service';
import { UserService } from '../user/user.service';
import { EmployeeGetCommand } from '../employee/commands/employee.get.command';
import * as moment from 'moment';
import { TimeLogCreateCommand } from '../timesheet/commands';

@Injectable()
export class HubstaffService {
	constructor(
		private _httpService: HttpService,
		private _integrationService: IntegrationService,
		private _integrationSettingService: IntegrationSettingService,
		private _organizationProjectService: OrganizationProjectsService,
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

	async addIntegration(body: ICreateIntegrationDto): Promise<IIntegration> {
		const headers = {
			'Content-Type': 'application/x-www-form-urlencoded'
		};
		const { client_id, client_secret, tenantId, code, redirect_uri } = body;
		const urlParams = new URLSearchParams();

		urlParams.append('client_id', client_id);
		urlParams.append('code', code);
		urlParams.append('grant_type', 'authorization_code');
		urlParams.append('redirect_uri', redirect_uri);
		urlParams.append('client_secret', client_secret);

		const projectTiedSettings = await this._integrationEntitySettingTiedEntityService.create(
			PROJECT_TIED_ENTITIES
		);

		const settingsForEntities = DEFAULT_ENTITY_SETTINGS.map(
			(settingEntity) =>
				settingEntity.entity === IntegrationEntity.PROJECT
					? {
							...settingEntity,
							tiedEntities: projectTiedSettings
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
						]
					})
				),
				catchError((err) => {
					throw new BadRequestException(err);
				})
			)
			.toPromise();
	}

	async syncProjects({
		integrationId,
		orgId,
		projects
	}): Promise<IIntegrationMap[]> {
		const integrationMaps = await projects.map(
			async ({ name, sourceId }) => {
				const gauzyProject = await this._organizationProjectService.create(
					{
						name,
						organizationId: orgId,
						public: true,
						type: 'RATE',
						currency: 'BGN'
					}
				);
				// const {
				// 	record: integration
				// } = await this._integrationService.findOneOrFail(integrationId);

				return await this._integrationMapService.create({
					gauzyId: gauzyProject.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.PROJECT
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	async syncOrganizations({
		integrationId,
		organizations
	}): Promise<IIntegrationMap[]> {
		const integrationMaps = await organizations.map(
			async (organization) => {
				const gauzyOrganization = await this.commandBus.execute(
					new OrganizationCreateCommand(organization)
				);

				// const {
				// 	record: integration
				// } = await this._integrationService.findOneOrFail(integrationId);

				return await this._integrationMapService.create({
					gauzyId: gauzyOrganization.id,
					integrationId,
					sourceId: organization.sourceId,
					entity: IntegrationEntity.ORGANIZATION
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
					new OrganizationClientsCreateCommand({
						name,
						organizationId,
						primaryEmail: emails[0]
					})
				);

				// const {
				// 	record: integration
				// } = await this._integrationService.findOneOrFail(integrationId);

				return await this._integrationMapService.create({
					gauzyId: gauzyClient.id,
					integrationId,
					sourceId: id,
					entity: IntegrationEntity.CLIENT
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	async syncTasks({
		integrationId,
		projectId,
		tasks
	}): Promise<IIntegrationMap[]> {
		const integrationMaps = await tasks.map(
			async ({ summary: title, id, status }) => {
				const gauzyTask = await this.commandBus.execute(
					new TaskCreateCommand({
						title,
						projectId,
						description: 'Hubstaff Task',
						status
					})
				);

				// const {
				// 	record: integration
				// } = await this._integrationService.findOneOrFail(integrationId);

				return await this._integrationMapService.create({
					gauzyId: gauzyTask.id,
					integrationId,
					sourceId: id,
					entity: IntegrationEntity.TASK
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	async syncTimeLogs({
		integrationId,
		projectId,
		activities,
		token,
		organizationId
	}): Promise<IIntegrationMap[]> {
		// "id": 1286268733,
		// "time_slot": "2020-04-25T21:50:00Z", ???
		// "starts_at": "2020-04-25T21:50:35Z",  ----> startedAt LOG/SLOT
		// task_id ---> taskId ignore for now
		// "user_id": 851172,  ---> employeeId  LOG/SLOT
		// "project_id": 1002338, --- projectId LOG
		// "keyboard": 1, ----> keyboard SLOT
		// "mouse": 9,  ----> mouse SLOT
		// "overall": 9,  ---> overall SLOT
		// "tracked": 11, --->  stoppedAt starts_at + duration LOG/SLOT
		// "billable": true, ---> isBillable LOG
		// "client": "windows" | "manual"  ---> logType ? LOG

		// ============ TIME LOG ===============

		// 	employeeId: string;
		// projectId?: string;
		// taskId?: string;
		// startedAt?: Date;
		// stoppedAt?: Date;
		// logType: string;
		// duration: number;
		// isBillable

		// =========== TIME SSLOT ==================

		// stoppedAt: Date;
		// startedAt: Date;
		// overall?: number;
		// mouse: number;
		// keyboard: number;
		// duration: number;
		// employeeId: string;

		const integrationMaps = await activities.map(
			async ({
				id,
				user_id,
				starts_at,
				billable,
				client,
				tracked,
				time_slot,
				keyboard,
				mouse,
				overall
			}) => {
				let {
					record: employee
				} = await this._integrationMapService.findOneOrFail({
					where: {
						sourceId: user_id,
						entity: IntegrationEntity.EMPLOYEE
					}
				});

				if (!employee) {
					employee = await this._handleEmployee({
						user_id,
						token,
						integrationId,
						organizationId
					});
				}

				const gauzyTimeLog = await this.commandBus.execute(
					new TimeLogCreateCommand({
						projectId,
						employeeId: employee.id,
						logType:
							client === 'windows'
								? TimeLogType.TRACKED
								: TimeLogType.MANUAL,
						startedAt: starts_at,
						duration: tracked,
						isBillable: billable
					})
				);
				console.log(gauzyTimeLog, 'LOG');

				return await this._integrationMapService.create({
					gauzyId: gauzyTimeLog.id,
					integrationId,
					sourceId: id,
					entity: IntegrationEntity.ACTIVITY
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	async syncEmployee({ integrationId, user, organizationId }) {
		let { record } = await this._userService.findOneOrFail({
			where: { email: user.email }
		});
		let employee;
		console.log(record, 'REKORD');
		if (record) {
			employee = await this.commandBus.execute(
				new EmployeeGetCommand({ where: { userId: record.id } })
			);
		} else {
			const [role, organization] = await Promise.all([
				this._roleService.findOne({
					where: { name: RolesEnum.EMPLOYEE }
				}),
				this._organizationService.findOne({
					where: { id: organizationId }
				})
			]);
			const [firstName, lastName] = user.name.split(' ');
			employee = await this.commandBus.execute(
				new EmployeeCreateCommand({
					user: {
						email: user.email,
						firstName,
						lastName,
						role,
						tags: null,
						tenant: null
					},
					password: 'hubstaff', // keep in env
					organization
				})
			);
		}

		// const {
		// 	record: integration
		// } = await this._integrationService.findOneOrFail(integrationId);
		console.log(employee, 'EMPL');
		return await this._integrationMapService.create({
			gauzyId: employee.id,
			integrationId,
			sourceId: user.id,
			entity: IntegrationEntity.EMPLOYEE
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
		const { projects } = await this.fetchIntegration(
			`https://api.hubstaff.com/v2/organizations/${sourceId}/projects?status=all`,
			token
		);
		const projectMap = projects.map(({ name, id }) => ({
			name,
			sourceId: id
		}));

		return await this.syncProjects({
			integrationId,
			orgId: gauzyId,
			projects: projectMap
		});
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

	private async _handleTasks(projectsMap, integrationId, token) {
		const tasksMap = await Promise.all(
			projectsMap.map(async (project) => {
				const { tasks } = await this.fetchIntegration(
					`https://api.hubstaff.com/v2/projects/${project.sourceId}/tasks`,
					token
				);

				return await this.syncTasks({
					integrationId,
					tasks,
					projectId: project.gauzyId
				});
			})
		);

		return tasksMap.flat();
	}

	private async _handleActivities(
		projectsMap,
		integrationId,
		token,
		organizationId,
		dateRange
	) {
		// should be fetch from client
		const start = moment(dateRange.start).format('YYYY-MM-DD');
		const end = moment(dateRange.end).format('YYYY-MM-DD');

		const activitiesMap = await Promise.all(
			projectsMap.map(async (project) => {
				const { activities } = await this.fetchIntegration(
					`https://api.hubstaff.com/v2/projects/${project.sourceId}/activities/time_slot?date[start]=${start}&date[stop]=${end}`,
					token
				);

				return await this.syncTimeLogs({
					integrationId,
					activities,
					projectId: project.gauzyId,
					token,
					organizationId
				});
			})
		);

		return activitiesMap.flat();
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

		const syncedEntities = await Promise.all(
			entitiesToSync.map(async (setting) => {
				switch (setting.entity) {
					case IntegrationEntity.PROJECT:
						let tasks, activities;
						const projectsMap = await this._handleProjects(
							sourceId,
							integrationId,
							gauzyId,
							token
						);
						const taskSetting = setting.tiedEntities.find(
							(setting) =>
								setting.entity === IntegrationEntity.TASK
						);

						const activitySetting = setting.tiedEntities.find(
							(setting) =>
								setting.entity === IntegrationEntity.ACTIVITY
						);
						if (taskSetting.sync) {
							tasks = await this._handleTasks(
								projectsMap,
								integrationId,
								token
							);
						}

						if (activitySetting.sync) {
							activities = await this._handleActivities(
								projectsMap,
								integrationId,
								token,
								gauzyId,
								dateRange
							);
						}
						return { tasks, projectsMap, activities };
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

		return syncedEntities;
	}
}
