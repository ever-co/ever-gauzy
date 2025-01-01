import { Injectable, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CommandBus } from '@nestjs/cqrs';
import { AxiosError, AxiosResponse } from 'axios';
import { DeepPartial } from 'typeorm';
import { catchError, firstValueFrom, lastValueFrom, map, switchMap } from 'rxjs';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';
import { isEmpty, isNotEmpty, isObject } from '@gauzy/common';
import {
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
	IIntegrationEntitySetting,
	IDateRangeActivityFilter,
	ComponentLayoutStyleEnum,
	ActivityType,
	IDateRange,
	OrganizationProjectBudgetTypeEnum,
	OrganizationContactBudgetTypeEnum,
	IActivity,
	ID
} from '@gauzy/contracts';
import {
	EmployeeCreateCommand,
	EmployeeGetCommand,
	IntegrationMapService,
	IntegrationMapSyncActivityCommand,
	IntegrationMapSyncEntityCommand,
	IntegrationMapSyncOrganizationCommand,
	IntegrationMapSyncProjectCommand,
	IntegrationMapSyncScreenshotCommand,
	IntegrationMapSyncTaskCommand,
	IntegrationMapSyncTimeLogCommand,
	IntegrationService,
	IntegrationMapSyncTimeSlotCommand,
	IntegrationSettingService,
	UserService,
	RoleService,
	OrganizationService,
	IntegrationTenantService,
	IntegrationTenantUpdateOrCreateCommand,
	OrganizationContactCreateCommand,
	RequestContext,
	DEFAULT_ENTITY_SETTINGS,
	PROJECT_TIED_ENTITIES,
	mergeOverlappingDateRanges
} from '@gauzy/core';
import { HUBSTAFF_AUTHORIZATION_URL } from './hubstaff.config';
import {
	ICreateHubstaffIntegrationInput,
	IHubstaffLogFromTimeSlots,
	IHubstaffOrganization,
	IHubstaffProject,
	IHubstaffOrganizationsResponse,
	IHubstaffProjectResponse,
	IHubstaffProjectsResponse,
	IHubstaffTimeSlotActivity
} from './hubstaff.model';

@Injectable()
export class HubstaffService {
	constructor(
		private readonly _httpService: HttpService,
		private readonly _commandBus: CommandBus,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _integrationSettingService: IntegrationSettingService,
		private readonly _integrationMapService: IntegrationMapService,
		private readonly _roleService: RoleService,
		private readonly _organizationService: OrganizationService,
		private readonly _userService: UserService,
		private readonly _integrationService: IntegrationService
	) {}

	/**
	 * Fetch data from an external integration API using HTTP GET request.
	 *
	 * @param {string} url - The URL to fetch data from.
	 * @param {string} token - Bearer token for authorization.
	 * @returns {Promise<any>} - A promise resolving to the fetched data.
	 */
	async fetchIntegration<T = any>(url: string, token: string): Promise<any> {
		const headers = {
			Authorization: `Bearer ${token}`
		};
		return firstValueFrom(
			this._httpService.get(url, { headers }).pipe(
				catchError((error: AxiosError<any>) => {
					const response: AxiosResponse<any> = error.response;
					console.log('Error while hubstaff API: %s', response);

					/** Handle hubstaff http exception */
					throw new HttpException({ message: error.message, error }, response.status);
				}),
				map((response: AxiosResponse<T>) => response.data)
			)
		);
	}

	/**
	 * Refresh the access token for the specified integration.
	 *
	 * @param integrationId The ID of the integration.
	 * @returns The new tokens.
	 */
	async refreshToken(integrationId: ID) {
		const settings = await this._integrationSettingService.find({
			where: {
				integration: { id: integrationId },
				integrationId
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
					client_id: current.settingsName === 'client_id' ? current.settingsValue : prev.client_id,
					client_secret:
						current.settingsName === 'client_secret' ? current.settingsValue : prev.client_secret,
					refresh_token: current.settingsName === 'refresh_token' ? current.settingsValue : prev.refresh_token
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
			const tokens$ = this._httpService
				.post(`${HUBSTAFF_AUTHORIZATION_URL}/access_tokens`, urlParams, {
					headers
				})
				.pipe(map((response: AxiosResponse<any>) => response.data));
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

	/**
	 * Retrieve the Hubstaff access token for a given integration.
	 *
	 * @param integrationId The ID of the integration.
	 * @returns The integration setting containing the access token.
	 * @throws NotFoundException if the access token is not found.
	 */
	async getHubstaffToken(integrationId: ID): Promise<IIntegrationSetting> {
		try {
			return await this._integrationSettingService.findOneByWhereOptions({
				integration: { id: integrationId },
				integrationId,
				settingsName: 'access_token'
			});
		} catch (error) {
			throw new NotFoundException(`Access token for integration ID ${integrationId} not found`);
		}
	}

	/**
	 * Adds a new Hubstaff integration.
	 *
	 * @param body The input data for creating a Hubstaff integration.
	 * @returns The created or updated integration tenant.
	 */
	async addIntegration(body: ICreateHubstaffIntegrationInput): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();
		const { client_id, client_secret, code, redirect_uri, organizationId } = body;

		// Prepare URL search parameters for the Hubstaff token request.
		const urlParams = new URLSearchParams();
		urlParams.append('client_id', client_id);
		urlParams.append('code', code);
		urlParams.append('grant_type', 'authorization_code');
		urlParams.append('redirect_uri', redirect_uri);
		urlParams.append('client_secret', client_secret);

		// Find the integration by provider.
		const integration = await this._integrationService.findOneByOptions({
			where: { provider: IntegrationEnum.HUBSTAFF }
		});

		// Map project-tied entities with organization and tenant IDs.
		const tiedEntities = PROJECT_TIED_ENTITIES.map((entity) => ({
			...entity,
			organizationId,
			tenantId
		}));

		const entitySettings = DEFAULT_ENTITY_SETTINGS.map((settingEntity) => {
			if (settingEntity.entity === IntegrationEntity.PROJECT) {
				return {
					...settingEntity,
					tiedEntities
				};
			}
			return {
				...settingEntity,
				organizationId,
				tenantId
			};
		}) as IIntegrationEntitySetting[];

		const tokens$ = this._httpService
			.post(`${HUBSTAFF_AUTHORIZATION_URL}/access_tokens`, urlParams, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			})
			.pipe(
				switchMap(({ data }) =>
					this._commandBus.execute(
						new IntegrationTenantUpdateOrCreateCommand(
							{
								name: IntegrationEnum.HUBSTAFF,
								integration: { provider: IntegrationEnum.HUBSTAFF },
								tenantId,
								organizationId
							},
							{
								name: IntegrationEnum.HUBSTAFF,
								integration,
								organizationId,
								tenantId,
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
								].map((setting) => ({
									...setting,
									tenantId,
									organizationId
								}))
							}
						)
					)
				),
				catchError((error) => {
					throw new BadRequestException(error);
				})
			);

		return await lastValueFrom(tokens$);
	}

	/**
	 * Fetches and returns a list of organizations from Hubstaff.
	 *
	 * @param {string} token - The access token for authentication with the Hubstaff API.
	 * @returns {Promise<IHubstaffOrganization[]>} - A promise that resolves to an array of Hubstaff organizations.
	 * @throws {Error} - Throws an error if the fetch operation fails.
	 */
	async fetchOrganizations(token: string): Promise<IHubstaffOrganization[]> {
		try {
			const response = await this.fetchIntegration<IHubstaffOrganizationsResponse>('organizations', token);
			const { organizations } = response;
			return organizations;
		} catch (error) {
			console.error('Failed to fetch Hubstaff organizations:', error);
			throw new Error('Unable to fetch organizations from Hubstaff');
		}
	}

	/**
	 * Fetches and returns a list of projects for a specified organization from Hubstaff.
	 *
	 * @param {object} params - The parameters object.
	 * @param {string} params.organizationId - The ID of the organization.
	 * @param {string} params.token - The access token for authentication with the Hubstaff API.
	 * @returns {Promise<IHubstaffProject[]>} - A promise that resolves to an array of Hubstaff projects.
	 * @throws {Error} - Throws an error if the fetch operation fails.
	 */
	async fetchOrganizationProjects({
		organizationId,
		token
	}: {
		organizationId: string;
		token: string;
	}): Promise<IHubstaffProject[]> {
		try {
			const response = await this.fetchIntegration<IHubstaffProjectsResponse>(
				`organizations/${organizationId}/projects?status=all&include=clients`,
				token
			);
			const { projects } = response;
			return projects;
		} catch (error) {
			console.error('Failed to fetch Hubstaff projects:', error);
			throw new Error('Unable to fetch projects from Hubstaff');
		}
	}

	/**
	 * Syncs projects from a third-party integration with the local system.
	 *
	 * @param {object} params - The parameters object.
	 * @param {string} params.integrationId - The ID of the integration.
	 * @param {string} params.organizationId - The ID of the organization.
	 * @param {Array<{ sourceId: string }>} params.projects - The list of projects to sync, each containing a sourceId.
	 * @param {string} params.token - The access token for authentication with the Hubstaff API.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to an array of integration maps.
	 * @throws {HttpException} - Throws an HTTP exception if the sync operation fails.
	 * @returns
	 */
	async syncProjects({
		integrationId,
		organizationId,
		projects,
		token
	}: {
		integrationId: string;
		organizationId: string;
		projects: Array<{ sourceId: string }>;
		token: string;
	}): Promise<IIntegrationMap[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			return await Promise.all(
				projects.map(async ({ sourceId }) => {
					const { project } = await this.fetchIntegration<IHubstaffProjectResponse>(`projects/${sourceId}`, token);

					/** Third Party Organization Project Map */
					return await this._commandBus.execute(
						new IntegrationMapSyncProjectCommand({
							entity: {
								name: project.name,
								description: project.description,
								billable: project.billable,
								public: true,
								billing: ProjectBillingEnum.RATE,
								currency: env.defaultCurrency as CurrenciesEnum,
								organizationId,
								tenantId,
								/** Set Project Budget Here */
								...(project.budget
									? {
											budgetType: project.budget.type || OrganizationProjectBudgetTypeEnum.COST,
											startDate: project.budget.start_date || null,
											budget: project.budget[
												project.budget.type || OrganizationProjectBudgetTypeEnum.COST
											]
									  }
									: {})
							},
							sourceId,
							integrationId,
							organizationId,
							tenantId
						})
					);
				})
			);
		} catch (error) {
			console.log(
				`Error while syncing ${IntegrationEntity.PROJECT} entity for organization (${organizationId}): %s`,
				error?.message
			);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Syncs organizations from a third-party integration with the local system.
	 *
	 * @param {object} params - The parameters object.
	 * @param {string} params.integrationId - The ID of the integration.
	 * @param {string} params.organizationId - The ID of the local organization.
	 * @param {Array<{ sourceId: string }>} params.organizations - The list of organizations to sync, each containing a sourceId.
	 * @param {string} params.token - The access token for authentication with the Hubstaff API.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to an array of integration maps.
	 * @throws {HttpException} - Throws an HTTP exception if the sync operation fails.
	 */
	async syncOrganizations({
		integrationId,
		organizationId,
		organizations,
		token
	}: {
		integrationId: string;
		organizationId: string;
		organizations: Array<{ sourceId: string }>;
		token: string;
	}): Promise<IIntegrationMap[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			return await Promise.all(
				organizations.map(async ({ sourceId }) => {
					const { organization } = await this.fetchIntegration<IHubstaffProjectResponse>(
						`organizations/${sourceId}`,
						token
					);
					/** Third Party Organization Map */
					return await this._commandBus.execute(
						new IntegrationMapSyncOrganizationCommand({
							entity: {
								name: organization.name,
								isActive: organization.status === 'active',
								currency: env.defaultCurrency as CurrenciesEnum
							},
							sourceId,
							integrationId,
							organizationId,
							tenantId
						})
					);
				})
			);
		} catch (error) {
			console.log(
				`Error while syncing ${IntegrationEntity.ORGANIZATION} entity (${organizationId}): %s`,
				error?.message
			);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Syncs clients from a third-party integration with the local system.
	 *
	 * @param {object} params - The parameters object.
	 * @param {string} params.integrationId - The ID of the integration.
	 * @param {string} params.organizationId - The ID of the local organization.
	 * @param {Array<{ id: string, name: string, emails: string[], phone: string, budget?: any }>} params.clients - The list of clients to sync.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to an array of integration maps.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	async syncClients({
		integrationId,
		organizationId,
		clients
	}: {
		integrationId: string;
		organizationId: string;
		clients: Array<{ id: string; name: string; emails: string[]; phone: string; budget?: any }>;
	}): Promise<IIntegrationMap[]> {
		try {
			return await Promise.all(
				clients.map(async ({ id, name, emails, phone, budget = {} as any }) => {
					const { record } = await this._integrationMapService.findOneOrFailByOptions({
						where: {
							sourceId: id,
							entity: IntegrationEntity.CLIENT,
							organizationId
						}
					});
					if (record) {
						return record;
					}

					/**
					 * Set Client Budget Here
					 */
					let clientBudget = {};
					if (isNotEmpty(budget)) {
						clientBudget['budgetType'] = budget.type || OrganizationContactBudgetTypeEnum.COST;
						clientBudget['budget'] = budget[clientBudget['budgetType']];
					}

					const gauzyClient = await this._commandBus.execute(
						new OrganizationContactCreateCommand({
							name,
							organizationId,
							primaryEmail: emails[0],
							primaryPhone: phone,
							contactType: ContactType.CLIENT,
							...clientBudget
						})
					);
					return await this._commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: gauzyClient.id,
							integrationId,
							sourceId: id,
							entity: IntegrationEntity.CLIENT,
							organizationId
						})
					);
				})
			);
		} catch (error) {
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.CLIENT}`);
		}
	}

	/**
	 * Syncs screenshots from a third-party integration using timeslot with the local system.
	 *
	 * @param {object} params - The parameters object.
	 * @param {string} params.integrationId - The ID of the integration.
	 * @param {Array<any>} params.screenshots - The list of screenshots to sync.
	 * @param {string} params.token - The access token for authentication with the Hubstaff API.
	 * @param {string} params.organizationId - The ID of the local organization.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to an array of integration maps.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	async syncScreenshots({
		integrationId,
		screenshots,
		token,
		organizationId
	}: {
		integrationId: string;
		screenshots: Array<any>;
		token: string;
		organizationId: string;
	}): Promise<IIntegrationMap[]> {
		try {
			let integratedScreenshots: IIntegrationMap[] = [];
			for await (const screenshot of screenshots) {
				const { id, user_id } = screenshot;
				const employee = await this._getEmployeeByHubstaffUserId(user_id, token, integrationId, organizationId);
				integratedScreenshots.push(
					await this._commandBus.execute(
						new IntegrationMapSyncScreenshotCommand({
							entity: {
								employeeId: employee ? employee.gauzyId : null,
								...screenshot
							},
							sourceId: id,
							integrationId,
							organizationId
						})
					)
				);
			}
			return integratedScreenshots;
		} catch (error) {
			console.error(`Error syncing screenshots:`, error.message);
			throw new BadRequestException(`Can't sync ${IntegrationEntity.SCREENSHOT}`, error.message);
		}
	}

	/**
	 * Syncs tasks from a third-party integration with the local system.
	 *
	 * @param {object} params - The parameters object.
	 * @param {string} params.integrationId - The ID of the integration.
	 * @param {string} params.projectId - The ID of the project to which the tasks belong.
	 * @param {Array<any>} params.tasks - The list of tasks to sync.
	 * @param {string} params.organizationId - The ID of the local organization.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to an array of integration maps.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	async syncTasks({
		integrationId,
		projectId,
		tasks,
		organizationId
	}: {
		integrationId: string;
		projectId: string;
		tasks: Array<any>;
		organizationId: string;
	}): Promise<IIntegrationMap[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const creatorId = RequestContext.currentUserId();

			return await Promise.all(
				tasks.map(async ({ summary: title, details = null, id, status, due_at }) => {
					if (!due_at) {
						due_at = new Date(moment().add(2, 'week').format('YYYY-MM-DD HH:mm:ss'));
					}

					// Step 1: Execute a command to initiate the synchronization process
					const triggeredEvent = false;
					return await this._commandBus.execute(
						new IntegrationMapSyncTaskCommand(
							{
								entity: {
									title,
									projectId,
									description: details,
									status: status.charAt(0).toUpperCase() + status.slice(1),
									creatorId,
									dueDate: due_at,
									organizationId,
									tenantId
								},
								sourceId: id,
								integrationId,
								organizationId,
								tenantId
							},
							triggeredEvent
						)
					);
				})
			);
		} catch (error) {
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.TASK}`);
		}
	}

	/**
	 * Retrieves an employee entity by their user ID from a third-party integration.
	 *
	 * @param {string} user_id - The ID of the employee in the third-party integration (Hubstaff).
	 * @param {string} token - The access token for authentication with the Hubstaff API.
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} organizationId - The ID of the local organization.
	 * @returns {Promise<any>} - A promise that resolves to the found employee entity.
	 */
	private async _getEmployeeByHubstaffUserId(
		user_id: string,
		token: string,
		integrationId: string,
		organizationId: string
	) {
		try {
			const tenantId = RequestContext.currentTenantId();
			return await this._integrationMapService.findOneByOptions({
				where: {
					sourceId: user_id,
					entity: IntegrationEntity.EMPLOYEE,
					organizationId,
					tenantId
				}
			});
		} catch (error) {
			// If employee is not found in local database, handle the scenario
			return await this._handleEmployee({
				user_id,
				token,
				integrationId,
				organizationId
			});
		}
	}

	/**
	 * Syncs time slot activities from Hubstaff with the local system.
	 *
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} organizationId - The ID of the local organization.
	 * @param {IIntegrationMap} employee - The mapped employee entity from Hubstaff to the local system.
	 * @param {IHubstaffTimeSlotActivity[]} timeSlots - The list of time slot activities to sync.
	 * @returns {Promise<any[]>} - A promise that resolves to an array of mapped time slot activities.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	async syncTimeSlots(
		integrationId: string,
		organizationId: string,
		employee: IIntegrationMap,
		timeSlots: IHubstaffTimeSlotActivity[]
	): Promise<any> {
		try {
			return timeSlots
				.filter(async (timeslot: IHubstaffTimeSlotActivity) => {
					return !!(await this._commandBus.execute(
						new IntegrationMapSyncTimeSlotCommand({
							entity: {
								...timeslot,
								employeeId: employee.gauzyId
							},
							sourceId: timeslot.id.toString(),
							integrationId,
							organizationId
						})
					));
				})
				.map(({ keyboard, mouse, overall, tracked, time_slot }) => ({
					keyboard,
					mouse,
					overall,
					duration: tracked,
					startedAt: time_slot
				}));
		} catch (error) {
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.TIME_SLOT}`);
		}
	}

	/**
	 * Syncs time logs from Hubstaff with the local system.
	 *
	 * @param {any[]} timeLogs - The list of time logs to sync.
	 * @param {string} token - The access token for authentication with Hubstaff API.
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} organizationId - The ID of the local organization.
	 * @param {string} projectId - The ID of the project related to the time logs.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to an array of integrated time logs.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	async syncTimeLogs(
		timeLogs: any,
		token: string,
		integrationId: string,
		organizationId: string,
		projectId: string
	): Promise<IIntegrationMap[]> {
		try {
			let integratedTimeLogs: IIntegrationMap[] = [];
			const tenantId = RequestContext.currentTenantId();

			for await (const timeLog of timeLogs) {
				const { id, user_id, task_id, logType, startedAt, stoppedAt, timeSlots } = timeLog;
				const employee = await this._getEmployeeByHubstaffUserId(user_id, token, integrationId, organizationId);
				const { record } = await this._integrationMapService.findOneOrFailByOptions({
					where: {
						sourceId: task_id,
						entity: IntegrationEntity.TASK,
						organizationId,
						tenantId
					}
				});
				const syncTimeSlots = await this.syncTimeSlots(integrationId, organizationId, employee, timeSlots);
				integratedTimeLogs.push(
					await this._commandBus.execute(
						new IntegrationMapSyncTimeLogCommand({
							entity: {
								projectId,
								employeeId: employee.gauzyId,
								taskId: record ? record.gauzyId : null,
								logType,
								startedAt,
								stoppedAt,
								source: TimeLogSourceEnum.HUBSTAFF,
								organizationId,
								tenantId,
								timeSlots: syncTimeSlots
							},
							sourceId: id,
							integrationId,
							organizationId
						})
					)
				);
			}
			return integratedTimeLogs;
		} catch (error) {
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.TIME_LOG}`);
		}
	}

	/**
	 * Syncs an employee from a third-party integration with the local system.
	 *
	 * @param {object} params - The parameters object.
	 * @param {string} params.integrationId - The ID of the integration.
	 * @param {object} params.user - The user object representing the employee from the third-party integration.
	 * @param {string} params.organizationId - The ID of the local organization.
	 * @returns {Promise<any>} - A promise that resolves to the synchronized employee entity.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	async syncEmployee({
		integrationId,
		user,
		organizationId
	}: {
		integrationId: string;
		user: any; // Define the type of `user` object based on your schema
		organizationId: string;
	}): Promise<any> {
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
				employee = await this._commandBus.execute(new EmployeeGetCommand({ where: { userId: record.id } }));
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
				employee = await this._commandBus.execute(
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
						startedWorkOn: new Date(moment().format('YYYY-MM-DD HH:mm:ss')),
						isActive,
						tenantId
					})
				);
			}
			return await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: employee.id,
					integrationId,
					sourceId: user.id,
					entity: IntegrationEntity.EMPLOYEE,
					organizationId
				})
			);
		} catch (error) {
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.EMPLOYEE}`);
		}
	}

	/**
	 * Handles synchronization of an employee from a third-party integration with the local system.
	 *
	 * @param {object} params - The parameters object.
	 * @param {string} params.user_id - The ID of the user in the third-party integration.
	 * @param {string} params.integrationId - The ID of the integration.
	 * @param {string} params.token - The access token for authentication with the third-party API.
	 * @param {string} params.organizationId - The ID of the local organization.
	 * @returns {Promise<any>} - A promise that resolves to the synchronized employee entity.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	private async _handleEmployee({
		user_id,
		integrationId,
		token,
		organizationId
	}: {
		user_id: string;
		integrationId: string;
		token: string;
		organizationId: string;
	}): Promise<any> {
		try {
			const { user } = await this.fetchIntegration(`users/${user_id}`, token);
			return await this.syncEmployee({
				integrationId,
				user,
				organizationId
			});
		} catch (error) {
			throw new BadRequestException(error, `Can\'t handle ${IntegrationEntity.EMPLOYEE}`);
		}
	}

	/**
	 * Handles synchronization of projects from a third-party integration with the local system.
	 *
	 * @param {string} sourceId - The ID of the organization in the third-party integration.
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} gauzyId - The ID of the local organization in Gauzy.
	 * @param {string} token - The access token for authentication with the third-party API.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to the synchronized projects.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	private async _handleProjects(
		sourceId: string,
		integrationId: string,
		gauzyId: string,
		token: string
	): Promise<IIntegrationMap[]> {
		try {
			const { projects } = await this.fetchIntegration(`organizations/${sourceId}/projects?status=all`, token);
			const projectMap = projects.map(({ name, id, billable, description }) => ({
				name,
				sourceId: id,
				billable,
				description
			}));
			return await this.syncProjects({
				integrationId,
				organizationId: gauzyId,
				projects: projectMap,
				token
			});
		} catch (error) {
			throw new BadRequestException(`Can\'t handle ${IntegrationEntity.PROJECT}`);
		}
	}

	/**
	 * Handles synchronization of clients from a third-party integration with the local system.
	 *
	 * @param {string} sourceId - The ID of the organization in the third-party integration.
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} gauzyId - The ID of the local organization in Gauzy.
	 * @param {string} token - The access token for authentication with the third-party API.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to the synchronized clients.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	private async _handleClients(
		sourceId: string,
		integrationId: string,
		gauzyId: string,
		token: string
	): Promise<IIntegrationMap[]> {
		try {
			const { clients } = await this.fetchIntegration(`organizations/${sourceId}/clients?status=active`, token);
			return await this.syncClients({
				integrationId,
				organizationId: gauzyId,
				clients
			});
		} catch (error) {
			throw new BadRequestException(error, `Can\'t handle ${IntegrationEntity.CLIENT}`);
		}
	}

	/**
	 * Handles synchronization of tasks from a third-party integration with the local system.
	 *
	 * @param {any[]} projectsMap - Array of projects mapped with sourceId and gauzyId.
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} token - The access token for authentication with the third-party API.
	 * @param {string} gauzyId - The ID of the local organization in Gauzy.
	 * @returns {Promise<IIntegrationMap[][]>} - A promise that resolves to an array of synchronized tasks.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	private async _handleTasks(
		projectsMap: any[],
		integrationId: string,
		token: string,
		gauzyId: string
	): Promise<IIntegrationMap[][]> {
		try {
			const tasksMap = await Promise.all(
				projectsMap.map(async (project) => {
					const { tasks } = await this.fetchIntegration(`projects/${project.sourceId}/tasks`, token);
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
			throw new BadRequestException(error, `Can\'t handle ${IntegrationEntity.TASK}`);
		}
	}

	/**
	 * Sync URL activities from a third-party integration with the local system.
	 *
	 * @param {object} param0 - Parameters for synchronization.
	 * @param {string} param0.integrationId - The ID of the integration.
	 * @param {string} param0.projectId - The ID of the project associated with the activities.
	 * @param {object[]} param0.activities - Array of URL activities to sync.
	 * @param {string} param0.token - Access token for authentication with the third-party API.
	 * @param {string} param0.organizationId - The ID of the local organization in Gauzy.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to an array of synchronized integration maps.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
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
			return await Promise.all(
				await activities.map(async ({ id, site, tracked, user_id, time_slot, task_id }) => {
					const time = moment(time_slot).format('HH:mm:ss');
					const date = moment(time_slot).format('YYYY-MM-DD');

					const employee = await this._getEmployeeByHubstaffUserId(
						user_id,
						token,
						integrationId,
						organizationId
					);
					const { record: task } = await this._integrationMapService.findOneOrFailByOptions({
						where: {
							sourceId: task_id,
							entity: IntegrationEntity.TASK,
							organizationId,
							tenantId
						}
					});
					const entity: IActivity = {
						title: site,
						duration: tracked,
						type: ActivityType.URL,
						time,
						date,
						projectId,
						employeeId: employee ? employee.gauzyId : null,
						taskId: task ? task.gauzyId : null,
						organizationId,
						activityTimestamp: time_slot
					};
					return await this._commandBus.execute(
						new IntegrationMapSyncActivityCommand({
							entity,
							sourceId: id,
							integrationId,
							organizationId
						})
					);
				})
			);
		} catch (error) {
			throw new BadRequestException(error, `Can\'t sync URL ${IntegrationEntity.ACTIVITY}`);
		}
	}

	/**
	 * Auto-sync URL activities for separate projects within a specified date range.
	 *
	 * @param {IIntegrationMap[]} projectsMap - Array of projects to sync URL activities for.
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} token - Access token for authentication with the third-party API.
	 * @param {string} organizationId - The ID of the local organization in Gauzy.
	 * @param {IDateRangeActivityFilter} dateRange - Date range filter for activities.
	 * @returns {Promise<any[]>} - A promise that resolves to an array of mapped URL activities.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
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

						const { urls, pagination = {} } = await this.fetchIntegration(url, token);

						if (pagination && pagination.hasOwnProperty('next_page_start_id')) {
							const { next_page_start_id } = pagination;
							nextPageStartId = next_page_start_id;
							stillRecordsAvailable = true;
						} else {
							nextPageStartId = null;
							stillRecordsAvailable = false;
						}
						syncedActivities.urlActivities.push(urls);
					}

					const activities = [].concat.apply([], syncedActivities.urlActivities);
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
			throw new BadRequestException(error, `Can\'t handle URL ${IntegrationEntity.ACTIVITY}`);
		}
	}

	/**
	 * Sync application activities with the local database.
	 *
	 * @param {Object} param0 - Parameters for synchronizing application activities.
	 * @param {string} param0.integrationId - The ID of the integration.
	 * @param {string} param0.projectId - The ID of the project associated with the activities.
	 * @param {any[]} param0.activities - Array of application activities to sync.
	 * @param {string} param0.token - Access token for authentication with the third-party API.
	 * @param {string} param0.organizationId - The ID of the local organization in Gauzy.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to an array of integration mappings.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
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

			// Map application activities and synchronize them
			return await Promise.all(
				await activities.map(async ({ id, name, tracked, user_id, time_slot, task_id }) => {
					const time = moment(time_slot).format('HH:mm:ss');
					const date = moment(time_slot).format('YYYY-MM-DD');

					// Fetch employee from local database or sync if not found
					const employee = await this._getEmployeeByHubstaffUserId(
						user_id,
						token,
						integrationId,
						organizationId
					);

					// Fetch task mapping from local database
					const { record: task } = await this._integrationMapService.findOneOrFailByOptions({
						where: {
							sourceId: task_id,
							entity: IntegrationEntity.TASK,
							organizationId,
							tenantId
						}
					});

					// Prepare activity entity to sync
					const entity: IActivity = {
						title: name,
						duration: tracked,
						type: ActivityType.APP,
						time,
						date,
						projectId,
						employeeId: employee ? employee.gauzyId : null,
						taskId: task ? task.gauzyId : null,
						organizationId,
						activityTimestamp: time_slot
					};

					// Execute command to sync activity with local database
					return await this._commandBus.execute(
						new IntegrationMapSyncActivityCommand({
							entity,
							sourceId: id,
							integrationId,
							organizationId
						})
					);
				})
			);
		} catch (error) {
			throw new BadRequestException(error, `Can\'t sync APP ${IntegrationEntity.ACTIVITY}`);
		}
	}

	/**
	 * Auto sync for application activities for separate projects.
	 *
	 * @param {IIntegrationMap[]} projectsMap - Array of projects to sync application activities for.
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} token - Access token for authentication with the third-party API.
	 * @param {string} organizationId - The ID of the local organization in Gauzy.
	 * @param {IDateRangeActivityFilter} dateRange - Date range filter for activities to sync.
	 * @returns {Promise<any[]>} - A promise that resolves to an array of mapped application activities.
	 * @throws {BadRequestException} - Throws a bad request exception if the sync operation fails.
	 */
	private async _handleAppActivities(
		projectsMap: IIntegrationMap[],
		integrationId: string,
		token: string,
		organizationId: string,
		dateRange: IDateRangeActivityFilter
	): Promise<any[]> {
		try {
			const start = moment(dateRange.start).format('YYYY-MM-DD');
			const end = moment(dateRange.end).format('YYYY-MM-DD');
			const pageLimit = 500;

			// Map application activities for each project and sync
			const appActivitiesMapped = await Promise.all(
				projectsMap.map(async (project) => {
					const { gauzyId, sourceId } = project;
					const syncedActivities = {
						applicationActivities: []
					};

					let stillRecordsAvailable = true;
					let nextPageStartId = null;

					// Fetch application activities in paginated manner
					while (stillRecordsAvailable) {
						let url = `projects/${sourceId}/application_activities?page_limit=${pageLimit}&time_slot[start]=${start}&time_slot[stop]=${end}`;
						if (nextPageStartId) {
							url += `&page_start_id=${nextPageStartId}`;
						}

						const { applications, pagination = {} } = await this.fetchIntegration(url, token);

						// Check for pagination
						if (pagination && pagination.hasOwnProperty('next_page_start_id')) {
							const { next_page_start_id } = pagination;
							nextPageStartId = next_page_start_id;
							stillRecordsAvailable = true;
						} else {
							nextPageStartId = null;
							stillRecordsAvailable = false;
						}

						// Accumulate fetched activities
						syncedActivities.applicationActivities.push(applications);
					}

					// Flatten activities array
					const activities = [].concat.apply([], syncedActivities.applicationActivities);

					// Sync activities with local database
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
			console.error(`Error handling APP activities:`, error.message);
			throw new BadRequestException(`Can't handle APP ${IntegrationEntity.ACTIVITY}`, error.message);
		}
	}

	/**
	 * Auto sync activities (time slot) for separate projects.
	 *
	 * @param {IIntegrationMap[]} projectsMap - Array of projects to sync activities for.
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} token - Access token for authentication with the third-party API.
	 * @param {string} organizationId - The ID of the local organization in Gauzy.
	 * @param {IDateRangeActivityFilter} dateRange - Date range filter for activities to sync.
	 * @returns {Promise<IIntegrationMap[]>} - A promise that resolves to an array of integrated time logs.
	 * @throws {HttpException|BadRequestException} - Throws an HTTP exception or bad request exception if the sync operation fails.
	 */
	private async _handleActivities(
		projectsMap: IIntegrationMap[],
		integrationId: string,
		token: string,
		organizationId: string,
		dateRange: IDateRangeActivityFilter
	): Promise<IIntegrationMap[]> {
		try {
			const start = moment(dateRange.start).format('YYYY-MM-DD');
			const end = moment(dateRange.end).format('YYYY-MM-DD');

			const integratedTimeLogs: IIntegrationMap[] = [];

			// Iterate over each project and fetch activities
			for await (const project of projectsMap) {
				const { activities } = await this.fetchIntegration<IHubstaffTimeSlotActivity[]>(
					`projects/${project.sourceId}/activities?time_slot[start]=${start}&time_slot[stop]=${end}`,
					token
				);

				// Skip processing if activities array is empty
				if (isEmpty(activities)) {
					continue;
				}

				// Format fetched activities into time logs
				const timeLogs = this.formatLogsFromSlots(activities);

				// Sync formatted time logs with local database
				const syncedTimeLogs = await this.syncTimeLogs(
					timeLogs,
					token,
					integrationId,
					organizationId,
					project.gauzyId
				);

				// Collect integrated time logs
				integratedTimeLogs.push(...syncedTimeLogs);
			}
			return integratedTimeLogs;
		} catch (error) {
			if (error instanceof HttpException) {
				// Re-throw HTTP exceptions with original response and status
				throw new HttpException(error.getResponse(), error.getStatus());
			}
			// Throw a BadRequestException with detailed error message
			throw new BadRequestException(`Can't handle ${IntegrationEntity.ACTIVITY}`, error.message);
		}
	}

	/**
	 * Auto sync screenshots activities for separate projects.
	 *
	 * @param {IIntegrationMap[]} projectsMap - Array of projects to sync screenshots activities for.
	 * @param {string} integrationId - The ID of the integration.
	 * @param {string} token - Access token for authentication with the third-party API.
	 * @param {string} organizationId - The ID of the local organization in Gauzy.
	 * @param {IDateRangeActivityFilter} dateRange - Date range filter for screenshots activities to sync.
	 * @returns {Promise<IIntegrationMap[][]>} - A promise that resolves to an array of arrays of integrated screenshots activities.
	 * @throws {BadRequestException} - Throws a bad request exception with a detailed error message if the sync operation fails.
	 */
	private async _handleScreenshots(
		projectsMap: IIntegrationMap[],
		integrationId: string,
		token: string,
		organizationId: string,
		dateRange: IDateRangeActivityFilter
	): Promise<IIntegrationMap[][]> {
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

					// Fetch screenshots activities in paginated manner
					while (stillRecordsAvailable) {
						let url = `projects/${sourceId}/screenshots?page_limit=${pageLimit}&time_slot[start]=${start}&time_slot[stop]=${end}`;
						if (nextPageStartId) {
							url += `&page_start_id=${nextPageStartId}`;
						}

						const { screenshots: fetchScreenshots, pagination = {} } = await this.fetchIntegration(
							url,
							token
						);

						if (pagination && pagination.hasOwnProperty('next_page_start_id')) {
							const { next_page_start_id } = pagination;
							nextPageStartId = next_page_start_id;
							stillRecordsAvailable = true;
						} else {
							nextPageStartId = null;
							stillRecordsAvailable = false;
						}

						syncedActivities.screenshots.push(fetchScreenshots);
					}

					// Flatten nested array of screenshots into a single array
					const screenshots = [].concat.apply([], syncedActivities.screenshots);

					// Sync fetched screenshots with local database
					return await this.syncScreenshots({
						integrationId,
						screenshots,
						token,
						organizationId
					});
				})
			);
		} catch (error) {
			// Throw a BadRequestException with detailed error message
			throw new BadRequestException(`Can't handle activities ${IntegrationEntity.SCREENSHOT}`, error.message);
		}
	}

	/**
	 * Automatically synchronize data for integrated entities based on entity settings.
	 *
	 * @param {Object} params - Parameters object containing integration details and synchronization configurations.
	 * @param {string} params.integrationId - The ID of the integration.
	 * @param {string} params.gauzyId - The ID of the local organization in Gauzy.
	 * @param {string} params.sourceId - The ID of the organization/source in the external system.
	 * @param {string} params.token - Access token for authentication with the third-party API.
	 * @param {IDateRangeActivityFilter} params.dateRange - Date range filter for activities to sync.
	 * @returns {Promise<Object[]>} - A promise that resolves to an array of objects containing synchronized data for each entity.
	 * @throws {BadRequestException} - Throws a bad request exception with a detailed error message if any synchronization operation fails.
	 */
	async autoSync({
		integrationId,
		gauzyId,
		sourceId,
		token,
		dateRange
	}: {
		integrationId: string;
		gauzyId: string;
		sourceId: string;
		token: string;
		dateRange: IDateRangeActivityFilter;
	}): Promise<Object[]> {
		console.log(`${IntegrationEnum.HUBSTAFF} integration start for ${integrationId}`);
		/**
		 * GET organization tenant integration entities settings
		 */
		const { entitySettings } = await this._integrationTenantService.findOneByIdString(integrationId, {
			relations: {
				entitySettings: {
					tiedEntities: true
				}
			}
		});

		//entities have depended entity. eg to fetch Task we need Project id or Org id, because our Task entity is related to Project, the relation here is same, we need project id to fetch Tasks
		const integratedMaps = await Promise.all(
			entitySettings.map(async (setting) => {
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
							tasks = await this._handleTasks(projectsMap, integrationId, token, gauzyId);
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
						const clients = await this._handleClients(sourceId, integrationId, gauzyId, token);
						return { clients };
				}
			})
		);
		console.log(`${IntegrationEnum.HUBSTAFF} integration end for ${integrationId}`);
		return integratedMaps;
	}

	/**
	 * Format Hubstaff time slot activities into structured time log entries.
	 *
	 * @param {IHubstaffTimeSlotActivity[]} slots - Array of Hubstaff time slot activities.
	 * @returns {any[]} - Array of structured time log entries.
	 */
	formatLogsFromSlots(slots: IHubstaffTimeSlotActivity[]): any[] {
		if (isEmpty(slots)) {
			return;
		}

		const range = [];
		let i = 0;
		while (slots[i]) {
			const start = moment(slots[i].starts_at);
			const end = moment(slots[i].starts_at).add(slots[i].tracked, 'seconds');

			range.push({
				start: start.toDate(),
				end: end.toDate()
			});
			i++;
		}

		const timeLogs: Array<any> = [];
		const dates: IDateRange[] = mergeOverlappingDateRanges(range);

		if (isNotEmpty(dates)) {
			dates.forEach(({ start, end }) => {
				let i = 0;
				const timeSlots = new Array();

				while (slots[i]) {
					const slotTime = moment(slots[i].starts_at);
					if (slotTime.isBetween(moment(start), moment(end), null, '[]')) {
						timeSlots.push(slots[i]);
					}
					i++;
				}

				const [activity] = this.getLogsActivityFromSlots(timeSlots);
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

	/**
	 * Extracts logs activity from time slots.
	 *
	 * @param {IHubstaffTimeSlotActivity[]} timeSlots - Array of Hubstaff time slot activities.
	 * @returns {IHubstaffLogFromTimeSlots[]} - Array of structured log activities.
	 */
	getLogsActivityFromSlots(timeSlots: IHubstaffTimeSlotActivity[]): IHubstaffLogFromTimeSlots[] {
		const timeLogs = timeSlots.reduce((prev, current) => {
			const prevLog = prev[current.date];
			return {
				...prev,
				[current.date]: prevLog
					? {
							id: current.id,
							date: current.date,
							user_id: prevLog.user_id,
							project_id: prevLog.project_id || null,
							task_id: prevLog.task_id || null,
							// this will take the last chunk(slot), maybe we should allow percentage for this, as one time log can have both manual and tracked
							logType: current.client === 'windows' ? TimeLogType.TRACKED : TimeLogType.MANUAL
					  }
					: {
							id: current.id,
							date: current.date,
							user_id: current.user_id,
							project_id: current.project_id || null,
							task_id: current.task_id || null,
							logType: current.client === 'windows' ? TimeLogType.TRACKED : TimeLogType.MANUAL
					  }
			};
		}, {});
		return Object.values(timeLogs);
	}
}
