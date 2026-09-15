import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { In, Between } from 'typeorm';
import * as UpworkApi from 'upwork-api';
import { Engagements } from 'upwork-api/lib/routers/hr/engagements.js';
import { Workdiary } from 'upwork-api/lib/routers/workdiary.js';
import { Snapshot } from 'upwork-api/lib/routers/snapshot.js';
import { Auth } from 'upwork-api/lib/routers/auth.js';
import { Users } from 'upwork-api/lib/routers/organization/users.js';
import { pluck, map, sortBy } from 'underscore';
import * as moment from 'moment';
import { environment } from '@gauzy/config';
import {
	IAccessTokenSecretPair,
	IAccessToken,
	IAccessTokenDto,
	ID,
	IntegrationEnum,
	IGetContractsDto,
	IGetWorkDiaryDto,
	IEngagement,
	IUpworkApiConfig,
	IUpworkApiConfigStatus,
	IUpworkSyncContractsRelatedDataDto,
	IIntegrationMap,
	CurrenciesEnum,
	ProjectBillingEnum,
	TimeLogType,
	IntegrationEntity,
	RolesEnum,
	ExpenseCategoriesEnum,
	OrganizationVendorEnum,
	IUpworkOfferStatusEnum,
	IUpworkProposalStatusEnum,
	IUpworkDateRange,
	ContactType,
	TimeLogSourceEnum,
	IUpworkClientSecretPair,
	IPagination,
	IDateRange,
	ComponentLayoutStyleEnum,
	ITimeLog,
	IIntegrationSetting
} from '@gauzy/contracts';
import {
	RequestContext,
	maskSecret,
	mergeOverlappingDateRanges,
	parseFindOptionsRelations,
	unixTimestampToDate
} from '@gauzy/core';
import {
	ExpenseService,
	IncomeService,
	IntegrationMapService,
	OrganizationService,
	RoleService,
	TimeSlotService,
	UserService
} from '@gauzy/core';
import {
	CreateTimeSlotMinutesCommand,
	EmployeeCreateCommand,
	EmployeeGetCommand,
	ExpenseCategoryFirstOrCreateCommand,
	ExpenseCreateCommand,
	IncomeCreateCommand,
	IntegrationMapSyncEntityCommand,
	IntegrationSettingCreateCommand,
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand,
	IntegrationTenantGetCommand,
	IntegrationTenantUpdateOrCreateCommand,
	OrganizationContactCreateCommand,
	OrganizationProjectCreateCommand,
	OrganizationProjectUpdateCommand,
	OrganizationVendorFirstOrCreateCommand,
	ScreenshotCreateCommand,
	TimeLogCreateCommand,
	TimeSlotCreateCommand
} from '@gauzy/core';
import { arrayToObject, isEmpty, isNotEmpty, isObject } from '@gauzy/utils';
import { ProposalCreateCommand } from '@gauzy/plugin-job-proposal';
import { UpworkReportService } from './upwork-report.service';
import { UpworkJobService } from './upwork-job.service';
import { UpworkOffersService } from './upwork-offers.service';

/**
 * The scope an Upwork integration is resolved within.
 *
 * Both halves are mandatory: a lookup missing either one would widen to "any integration in the
 * tenant" (TypeORM drops `undefined` conditions), which is exactly the failure mode a credential
 * resolver must not have.
 */
interface IUpworkIntegrationScope {
	/** The organization that owns the integration. */
	organizationId: ID;
	/** The tenant that owns the integration. Always taken from the request context, never from input. */
	tenantId: ID;
}

@Injectable()
export class UpworkService {
	private _upworkApi: UpworkApi;

	constructor(
		private readonly _expenseService: ExpenseService,
		private readonly _incomeService: IncomeService,
		private readonly _integrationMapService: IntegrationMapService,
		private readonly _userService: UserService,
		private readonly _roleService: RoleService,
		private readonly _organizationService: OrganizationService,
		private readonly _timeSlotService: TimeSlotService,
		private readonly _upworkReportService: UpworkReportService,
		private readonly _upworkJobService: UpworkJobService,
		private readonly _upworkOfferService: UpworkOffersService,
		private readonly _commandBus: CommandBus
	) {}

	/**
	 * Checks whether the Upwork app identified by `config.consumerKey` has already completed the
	 * OAuth handshake for this organization.
	 *
	 * Returns the integration id only. It used to spread the whole settings map — consumer secret,
	 * access token and access token secret included — into its result, so a caller one refactor away
	 * from returning it would have leaked live credentials (GHSA-3rqg-gpm9-gx84). Callers only ever
	 * needed "is it already authorized, and which integration is it".
	 *
	 * @param config - The Upwork client key/secret pair being authorized.
	 * @param organizationId - The organization the integration belongs to.
	 * @returns The owning integration id when an access token pair is already stored, otherwise `false`.
	 */
	private async _consumerHasAccessToken(
		config: IUpworkClientSecretPair,
		organizationId: string
	): Promise<{ integrationId: ID } | false> {
		const integrationSetting = await this._commandBus.execute(
			new IntegrationSettingGetCommand({
				where: {
					settingsValue: config.consumerKey,
					organizationId: organizationId
				},
				relations: parseFindOptionsRelations(['integration'])
			})
		);
		if (!integrationSetting) {
			return false;
		}

		const integrationSettings: IIntegrationSetting[] = await this._commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: {
					integration: integrationSetting.integration,
					organizationId
				}
			})
		);
		if (!integrationSettings.length) {
			return false;
		}

		const integrationSettingMap = arrayToObject(integrationSettings, 'settingsName', 'settingsValue');

		if (integrationSettingMap.accessToken && integrationSettingMap.accessTokenSecret) {
			return { integrationId: integrationSetting.integration.id };
		}

		return false;
	}

	async getAccessTokenSecretPair(
		config: IUpworkClientSecretPair,
		organizationId: string
	): Promise<IAccessTokenSecretPair> {
		const consumerAccessToken = await this._consumerHasAccessToken(config, organizationId);

		// access token live forever, if user already registered app, return the access token;
		if (consumerAccessToken) {
			console.log('consumerAccessToken already exits and will be reused');
			return;
		}
		const tenantId = RequestContext.currentTenantId();

		this._upworkApi = new UpworkApi(config);

		const authUrl = environment.upwork.callbackUrl;

		console.log(`Upwork callback URL: ${authUrl}`);

		return new Promise((resolve, reject) => {
			this._upworkApi.getAuthorizationUrl(authUrl, async (error, url, requestToken, requestTokenSecret) => {
				if (error) {
					reject(`can't get authorization url, error: ${error}`);
					return;
				}

				await this._commandBus.execute(
					new IntegrationTenantUpdateOrCreateCommand(
						{
							name: IntegrationEnum.UPWORK,
							integration: {
								provider: IntegrationEnum.UPWORK
							},
							tenantId,
							organizationId
						},
						{
							tenantId,
							organizationId,
							name: IntegrationEnum.UPWORK,
							entitySettings: [],
							settings: [
								{
									settingsName: 'consumerKey',
									settingsValue: config.consumerKey
								},
								{
									settingsName: 'consumerSecret',
									settingsValue: config.consumerSecret
								},
								{
									settingsName: 'requestToken',
									settingsValue: requestToken
								},
								{
									settingsName: 'requestTokenSecret',
									settingsValue: requestTokenSecret
								}
							].map((setting) => ({
								...setting,
								tenantId,
								organizationId
							}))
						}
					)
				);
				// `requestTokenSecret` is deliberately left out of the response: it signs the
				// access-token exchange, it is already stored as an integration setting, and no
				// client reads it (GHSA-3rqg-gpm9-gx84).
				return resolve({
					url,
					requestToken,
					organizationId
				});
			});
		});
	}

	/**
	 * Completes the Upwork OAuth 1.0a handshake and stores the minted access token pair.
	 *
	 * The freshly minted `accessToken` / `accessTokenSecret` are persisted as integration settings
	 * and are no longer echoed back to the caller: the browser only ever used `integrationId` to
	 * navigate, while the credentials it received sat in the Angular app's memory
	 * (GHSA-3rqg-gpm9-gx84).
	 *
	 * @param accessTokenDto - The OAuth request token and verifier returned by Upwork.
	 * @param organizationId - The organization the integration belongs to.
	 * @returns The id of the integration that now holds the access token.
	 */
	getAccessToken({ requestToken, verifier }: IAccessTokenDto, organizationId: string): Promise<IAccessToken> {
		return new Promise(async (resolve, reject) => {
			const { integration } = await this._commandBus.execute(
				new IntegrationSettingGetCommand({
					where: {
						settingsValue: requestToken,
						organizationId
					},
					relations: parseFindOptionsRelations(['integration'])
				})
			);
			const integrationSettings: IIntegrationSetting[] = await this._commandBus.execute(
				new IntegrationSettingGetManyCommand({
					where: {
						integration,
						organizationId
					}
				})
			);
			const integrationSetting = arrayToObject(integrationSettings, 'settingsName', 'settingsValue');

			this._upworkApi.getAccessToken(
				requestToken,
				integrationSetting.requestTokenSecret,
				verifier,
				async (error: any, accessToken: string, accessTokenSecret: string) => {
					if (error) {
						reject(new Error(error));
						return;
					}
					await this._commandBus.execute(
						new IntegrationSettingCreateCommand({
							integration,
							settingsName: 'accessToken',
							settingsValue: accessToken,
							organizationId
						})
					);
					await this._commandBus.execute(
						new IntegrationSettingCreateCommand({
							integration,
							settingsName: 'accessTokenSecret',
							settingsValue: accessTokenSecret,
							organizationId
						})
					);

					// Only the integration id leaves the server; the credentials stay in the
					// integration settings where the masking subscriber governs every read.
					resolve({ integrationId: integration.id });
				}
			);
		});
	}

	/**
	 * Builds the scope an integration is resolved within for the current request.
	 *
	 * The tenant always comes from the request context, never from the request payload, so a caller
	 * cannot name somebody else's tenant. The organization still comes from the request — as it did
	 * before — but is now mandatory, because an absent organization would have widened the lookup to
	 * the whole tenant.
	 *
	 * @param organizationId - The organization named by the request.
	 * @returns The resolved `{ organizationId, tenantId }` scope.
	 * @throws BadRequestException when either half of the scope is missing.
	 */
	private _currentScope(organizationId: ID): IUpworkIntegrationScope {
		const tenantId = RequestContext.currentTenantId();

		if (!organizationId || !tenantId) {
			throw new BadRequestException('Upwork integration lookup requires both an organization and a tenant');
		}

		return { organizationId, tenantId };
	}

	/**
	 * Loads an integration's settings as a `settingsName -> settingsValue` map, scoped to the caller.
	 *
	 * The map holds cleartext credentials and must never leave the server as-is.
	 *
	 * @param integrationId - The Upwork integration to read.
	 * @param scope - The organization and tenant the integration must belong to.
	 * @returns The integration's settings keyed by setting name.
	 * @throws BadRequestException when the integration id is missing.
	 * @throws NotFoundException when no such integration exists inside the caller's scope.
	 */
	private async _findIntegrationSettings(
		integrationId: ID,
		scope: IUpworkIntegrationScope
	): Promise<Record<string, string>> {
		if (!integrationId) {
			throw new BadRequestException('An Upwork integration id is required');
		}

		const { organizationId, tenantId } = scope;
		const integration = await this._commandBus.execute(
			new IntegrationTenantGetCommand({
				where: {
					id: integrationId,
					tenant: {
						id: tenantId
					},
					organizationId
				}
			})
		);

		// Fail closed: without this an out-of-scope id fell through to a settings lookup on an
		// `undefined` integration instead of being refused.
		if (!integration) {
			throw new NotFoundException(`Upwork integration was not found: ${integrationId}`);
		}

		const integrationSettings: IIntegrationSetting[] = await this._commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: {
					integration,
					organizationId
				}
			})
		);

		return arrayToObject(integrationSettings, 'settingsName', 'settingsValue');
	}

	/**
	 * Resolves the credentials the Upwork SDK needs, server-side, from an integration id.
	 *
	 * This is the single place Upwork credentials are assembled. Every route that talks to the
	 * Upwork API goes through it, so no endpoint has to accept an {@link IUpworkApiConfig} from a
	 * client and none has to hand one back (GHSA-3rqg-gpm9-gx84).
	 *
	 * @param integrationId - The Upwork integration to resolve credentials for.
	 * @param scope - The organization and tenant the integration must belong to.
	 * @returns The credential quadruple for the Upwork SDK.
	 * @throws NotFoundException when the integration is outside the caller's tenant or organization.
	 * @throws BadRequestException when the integration exists but is not fully authorized.
	 */
	private async resolveApiConfig(integrationId: ID, scope: IUpworkIntegrationScope): Promise<IUpworkApiConfig> {
		const {
			accessToken,
			consumerKey,
			consumerSecret,
			accessTokenSecret: accessSecret
		} = await this._findIntegrationSettings(integrationId, scope);

		// Fail closed: a half-authorized integration used to yield a config full of `undefined`,
		// which the Upwork SDK then signed requests with.
		if (!accessToken || !accessSecret || !consumerKey || !consumerSecret) {
			throw new BadRequestException(`Upwork integration is not authorized: ${integrationId}`);
		}

		return { accessToken, consumerKey, consumerSecret, accessSecret };
	}

	/**
	 * Returns the non-secret view of an Upwork integration's configuration.
	 *
	 * 🛑 This route used to answer with the cleartext `accessToken`, `consumerKey`, `consumerSecret`
	 * and `accessSecret` to anybody holding an integration permission in the tenant, because it
	 * read `settingsValue` into a plain object and so never went through the `IntegrationSetting`
	 * masking subscriber. It now answers with the connected/usable state only, and masks the one
	 * credential-derived field it still shows with the platform's {@link maskSecret}
	 * (GHSA-3rqg-gpm9-gx84).
	 *
	 * @param integrationId - The Upwork integration to describe.
	 * @param organizationId - The organization the integration belongs to.
	 * @returns A secret-free description of the integration's configuration.
	 */
	async getConfig(integrationId: ID, organizationId: ID): Promise<IUpworkApiConfigStatus> {
		const scope = this._currentScope(organizationId);
		const { accessToken, accessTokenSecret, consumerKey } = await this._findIntegrationSettings(
			integrationId,
			scope
		);

		return {
			integrationId,
			hasAccessToken: !!accessToken && !!accessTokenSecret,
			...(consumerKey ? { consumerKey: maskSecret(consumerKey) } : {})
		};
	}

	/**
	 * Lists the freelancer's Upwork engagements (a contract here is a project in Gauzy).
	 *
	 * @param getEngagementsDto - The integration and organization to read the engagements for.
	 * @returns The engagements reported by Upwork.
	 */
	async getContractsForFreelancer(getEngagementsDto: IGetContractsDto): Promise<IEngagement[]> {
		const { integrationId, organizationId } = getEngagementsDto ?? ({} as IGetContractsDto);
		const config = await this.resolveApiConfig(integrationId, this._currentScope(organizationId));

		return await this._getContractsForFreelancer(config);
	}

	/**
	 * Calls the Upwork engagements API with already-resolved credentials.
	 *
	 * @param config - Server-resolved Upwork API credentials.
	 * @returns The engagements reported by Upwork.
	 */
	private async _getContractsForFreelancer(config: IUpworkApiConfig): Promise<IEngagement[]> {
		const api = new UpworkApi(config);
		const engagements = new Engagements(api);
		const params = {};
		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				engagements.getList(params, (error, data) => {
					if (error) {
						reject(error);
					} else {
						const {
							engagements: { engagement }
						} = data;
						resolve(engagement);
					}
				});
			});
		});
	}

	/*
	 * Get specific contract using contractId
	 */
	private async _getContractByContractId(config: IUpworkApiConfig, contractId): Promise<IEngagement> {
		const api = new UpworkApi(config);
		const engagements = new Engagements(api);

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				engagements.getSpecific(contractId, (error, data) => {
					if (error) {
						reject(error);
					} else {
						const { engagement } = data;
						resolve(engagement);
					}
				});
			});
		});
	}

	async syncContracts({ integrationId, organizationId, contracts }): Promise<IIntegrationMap[]> {
		return await Promise.all(
			await contracts.map(
				async ({
					job__title: name,
					reference: sourceId,
					engagement_start_date,
					engagement_end_date,
					active_milestone
				}) => {
					const input = {
						name,
						organizationId,
						public: true,
						currency: environment.defaultCurrency as CurrenciesEnum
					};

					if (isObject(active_milestone)) {
						input['billing'] = ProjectBillingEnum.MILESTONES;
					} else {
						input['billing'] = ProjectBillingEnum.RATE;
					}

					// contract start date
					if (typeof engagement_start_date === 'string' && engagement_start_date.length > 0) {
						input['startDate'] = new Date(unixTimestampToDate(engagement_start_date));
					}
					// contract end date
					if (typeof engagement_end_date === 'string' && engagement_end_date.length > 0) {
						input['endDate'] = new Date(unixTimestampToDate(engagement_end_date));
					}

					const tenantId = RequestContext.currentTenantId();
					const { record: integrationMap } = await this._integrationMapService.findOneOrFailByOptions({
						where: {
							sourceId,
							entity: IntegrationEntity.PROJECT,
							organizationId,
							tenantId
						}
					});
					//if project already integrated then only update model/entity
					if (integrationMap) {
						await this._commandBus.execute(
							new OrganizationProjectUpdateCommand(integrationMap.gauzyId, input)
						);
						return integrationMap;
					}
					const project = await this._commandBus.execute(
						new OrganizationProjectCreateCommand(Object.assign({}, input))
					);
					return await this._commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: project.id,
							integrationId,
							sourceId,
							entity: IntegrationEntity.PROJECT,
							organizationId
						})
					);
				}
			)
		);
	}

	/**
	 * Reads an Upwork work diary — the source of the time slots and time logs Gauzy syncs.
	 *
	 * @param getWorkDiaryDto - The integration, organization, contract and date to read.
	 * @returns The work diary payload reported by Upwork.
	 */
	async getWorkDiary(getWorkDiaryDto: IGetWorkDiaryDto): Promise<any> {
		const { integrationId, organizationId, contractId, forDate } = getWorkDiaryDto ?? ({} as IGetWorkDiaryDto);
		const config = await this.resolveApiConfig(integrationId, this._currentScope(organizationId));

		return await this._getWorkDiary(config, contractId, forDate);
	}

	/**
	 * Calls the Upwork work diary API with already-resolved credentials.
	 *
	 * @param config - Server-resolved Upwork API credentials.
	 * @param contractId - The Upwork contract whose diary is read.
	 * @param forDate - The day to read the diary for.
	 * @returns The work diary payload reported by Upwork.
	 */
	private async _getWorkDiary(config: IUpworkApiConfig, contractId: string, forDate: Date): Promise<any> {
		const api = new UpworkApi(config);
		const workdiary = new Workdiary(api);
		const params = {
			offset: 0
		};
		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				workdiary.getByContract(contractId, moment(forDate).format('YYYYMMDD'), params, (err, data) =>
					err ? reject(err) : resolve(data)
				);
			});
		});
	}

	async syncTimeLog(timeLog): Promise<ITimeLog> {
		const organizationId = timeLog.organizationId;
		const tenantId = RequestContext.currentTenantId();

		const gauzyTimeLog = await this._commandBus.execute(
			new TimeLogCreateCommand({
				projectId: timeLog.projectId,
				employeeId: timeLog.employeeId,
				logType: timeLog.logType,
				startedAt: timeLog.startedAt,
				stoppedAt: timeLog.stoppedAt,
				source: TimeLogSourceEnum.UPWORK,
				organizationId,
				tenantId
			})
		);

		await this._commandBus.execute(
			new IntegrationMapSyncEntityCommand({
				gauzyId: gauzyTimeLog.id,
				integrationId: timeLog.integrationId,
				sourceId: timeLog.sourceId,
				entity: IntegrationEntity.TIME_LOG,
				organizationId
			})
		);

		return gauzyTimeLog;
	}

	async syncTimeSlots({ timeSlots, employeeId, integrationId, sourceId, organizationId }) {
		let integratedTimeSlots = [];
		const tenantId = RequestContext.currentTenantId();

		for await (const timeSlot of timeSlots) {
			const multiply = 10;
			const duration = 600;
			const { keyboard_events_count, mouse_events_count, cell_time, activity } = timeSlot;
			const gauzyTimeSlot = await this._commandBus.execute(
				new TimeSlotCreateCommand({
					employeeId,
					startedAt: new Date(moment.unix(cell_time).format('YYYY-MM-DD HH:mm:ss')),
					keyboard: keyboard_events_count,
					mouse: mouse_events_count,
					time_slot: new Date(moment.unix(cell_time).format('YYYY-MM-DD HH:mm:ss')),
					overall: activity * multiply,
					duration: duration,
					organizationId,
					tenantId
				})
			);
			const integratedSlot = await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: gauzyTimeSlot.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.TIME_SLOT,
					organizationId
				})
			);
			integratedTimeSlots = integratedTimeSlots.concat(integratedSlot);
		}

		return integratedTimeSlots;
	}

	async syncWorkDiaries(
		organizationId: string,
		integrationId: string,
		syncedContracts,
		config: IUpworkApiConfig,
		employeeId: string,
		forDate
	) {
		const workDiaries = await Promise.all(
			syncedContracts.map(async (contract) => {
				const wd = await this._getWorkDiary(config, contract.sourceId, forDate)
					.then((response) => response)
					.catch((error) => error);

				if (wd.hasOwnProperty('statusCode') && wd.statusCode === 404) {
					return wd;
				}

				const cells = wd.data.cells;
				const sourceId = wd.data.contract.record_id;

				if (isEmpty(cells)) {
					return [];
				}

				const integratedTimeLogs = [];
				const integratedTimeSlots = [];
				const integratedScreenshots = [];
				const timeSlotsActivities = [];

				const timeLogs = this.formatLogsFromSlots(cells);

				for await (const timeLog of timeLogs) {
					const { timeSlots = [] } = timeLog;
					const timeLogDto = {
						...timeLog,
						employeeId,
						integrationId,
						organizationId,
						projectId: contract.gauzyId,
						duration: timeSlots.length * 10 * 60,
						sourceId
					};
					const timeSlotsDto = {
						timeSlots,
						employeeId,
						integrationId,
						sourceId,
						organizationId
					};
					integratedTimeLogs.push(await this.syncTimeLog(timeLogDto));
					integratedTimeSlots.push(await this.syncTimeSlots(timeSlotsDto));
					integratedScreenshots.push(await this.syncSnapshots(timeSlotsDto));
					timeSlotsActivities.push(
						await this.getTimeSlotActivitiesByContractId({
							contractId: sourceId,
							employeeId,
							organizationId,
							config,
							timeSlots
						})
					);
				}
				return {
					integratedTimeLogs,
					integratedTimeSlots,
					integratedScreenshots,
					timeSlotsActivities
				};
			})
		);
		return workDiaries;
	}

	formatLogsFromSlots(slots) {
		if (isEmpty(slots)) {
			return;
		}

		const range = [];
		let i = 0;
		while (slots[i]) {
			const start = moment.unix(slots[i].cell_time).toDate();
			const end = moment.unix(slots[i].cell_time).add(10, 'minute').toDate();
			range.push({ start, end });
			i++;
		}

		const timeLogs = [];
		const dates: IDateRange[] = mergeOverlappingDateRanges(range);

		if (isNotEmpty(dates)) {
			dates.forEach(({ start, end }) => {
				let i = 0;
				const timeSlots = new Array();
				while (slots[i]) {
					const slotTime = moment.unix(slots[i].cell_time);
					if (slotTime.isBetween(moment(start), moment(end), null, '[]')) {
						timeSlots.push(slots[i]);
					}
					i++;
				}
				const activity = timeSlots.reduce(
					(prev, current) => {
						return {
							...prev,
							keyboard: (prev.keyboard += +current.keyboard_events_count),
							mouse: (prev.mouse += +current.mouse_events_count),
							logType: slots.manual ? TimeLogType.MANUAL : TimeLogType.TRACKED
						};
					},
					{
						keyboard: 0,
						mouse: 0
					}
				);
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
	 * Syncs everything hanging off a set of Upwork contracts: work diaries, reports and proposals.
	 *
	 * The Upwork credentials used for the sync are resolved server-side from `integrationId`; the
	 * request body used to carry them, which meant the Angular app held live credentials in memory
	 * and posted them back on every sync (GHSA-3rqg-gpm9-gx84).
	 *
	 * @param integrationId - The Upwork integration to resolve credentials from.
	 * @param organizationId - The organization the integration belongs to.
	 * @param contracts - The Upwork contracts to sync.
	 * @param employeeId - The Gauzy employee the synced data belongs to, when already known.
	 * @param entitiesToSync - The entity kinds to sync (work diary, report, proposal).
	 * @param providerReferenceId - The Upwork provider reference used to resolve the employee.
	 * @param providerId - The Upwork provider id used by the report sync.
	 * @returns One result per synced entity kind.
	 */
	async syncContractsRelatedData({
		integrationId,
		organizationId,
		contracts,
		employeeId,
		entitiesToSync,
		providerReferenceId,
		providerId
	}: IUpworkSyncContractsRelatedDataDto) {
		const config = await this.resolveApiConfig(integrationId, this._currentScope(organizationId));

		const syncedContracts = await this.syncContracts({
			contracts,
			integrationId,
			organizationId
		});

		if (!employeeId) {
			const employee = await this._getUpworkGauzyEmployee(
				providerReferenceId,
				integrationId,
				organizationId,
				config
			);
			employeeId = employee.gauzyId;
		}

		return await Promise.all(
			entitiesToSync.map(async (entity) => {
				switch (entity.key) {
					case 'workDiary':
						return await this.syncWorkDiaries(
							organizationId,
							integrationId,
							syncedContracts,
							config,
							employeeId,
							entity.datePicker.selectedDate
						);
					case 'report':
						return await this.syncReports(
							organizationId,
							integrationId,
							config,
							employeeId,
							providerReferenceId,
							providerId,
							entity.datePicker.selectedDate
						);
					case 'proposal':
						return await this.syncProposalsOffers(organizationId, integrationId, config, employeeId);
					default:
						return;
				}
			})
		);
	}

	/*
	 * Get timeslot minute activities
	 */
	async syncTimeSlotsActivity({ employeeId, organizationId, timeSlot, timeSlotActivity }) {
		try {
			const { minutes } = timeSlotActivity;
			const { cell_time } = timeSlot;
			const tenantId = RequestContext.currentTenantId();

			const integratedTimeSlotsMinutes = await Promise.all(
				minutes.map(async (minute) => {
					const { record: timeSlot } = await this._timeSlotService.findOneOrFailByOptions({
						where: {
							tenantId,
							employeeId,
							startedAt: moment(moment.unix(cell_time).format('YYYY-MM-DD HH:mm:ss')).toDate()
						}
					});

					if (!timeSlot) {
						return;
					}

					const { time, mouse, keyboard } = minute;

					const gauzyTimeSlotMinute = await this._commandBus.execute(
						new CreateTimeSlotMinutesCommand({
							mouse,
							keyboard,
							datetime: new Date(moment.unix(time).format('YYYY-MM-DD HH:mm:ss')),
							timeSlotId: timeSlot.id,
							organizationId,
							tenantId
						})
					);
					return gauzyTimeSlotMinute;
				})
			);

			return integratedTimeSlotsMinutes;
		} catch (error) {
			throw new BadRequestException('Cannot sync timeslot every minute activity');
		}
	}

	/*
	 * Get snapshots/timeslot minutes activities
	 */
	async getTimeSlotActivitiesByContractId({ contractId, employeeId, organizationId, config, timeSlots }) {
		const timeSlotActivities = await Promise.all(
			timeSlots.map(async (timeslot) => {
				const { snapshot: timeSlotActivity } = await this.getSnapshotByContractId(config, contractId, timeslot);
				const integratedTimeSlotActivities = await this.syncTimeSlotsActivity({
					employeeId,
					organizationId,
					timeSlot: timeslot,
					timeSlotActivity
				});

				return {
					integratedTimeSlotActivities
				};
			})
		);

		return timeSlotActivities;
	}

	/**
	 * Get snapshots for given contractId and Unix time
	 */
	async getSnapshotByContractId(config: IUpworkApiConfig, contractId, timeSlot): Promise<any> {
		const api = new UpworkApi(config);
		const snapshots = new Snapshot(api);
		const { snapshot_time: snapshotTime } = timeSlot;

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				snapshots.getByContract(contractId, snapshotTime, (err, data) => (err ? reject(err) : resolve(data)));
			});
		});
	}

	/*
	 * Sync Snapshots By Contract
	 */
	async syncSnapshots(timeSlotsData) {
		const { timeSlots = [], employeeId, integrationId, sourceId, organizationId } = timeSlotsData;
		const integrationMaps = await timeSlots.map(
			async ({ cell_time, screenshot_img, screenshot_img_thmb, snapshot_time }) => {
				const recordedAt = moment.unix(snapshot_time).format('YYYY-MM-DD HH:mm:ss');
				const activityTimestamp = moment.unix(cell_time).format('YYYY-MM-DD HH:mm:ss');

				const gauzyScreenshot = await this._commandBus.execute(
					new ScreenshotCreateCommand({
						file: screenshot_img,
						thumb: screenshot_img_thmb,
						recordedAt,
						activityTimestamp,
						employeeId,
						organizationId
					})
				);

				return await this._commandBus.execute(
					new IntegrationMapSyncEntityCommand({
						gauzyId: gauzyScreenshot.id,
						integrationId,
						sourceId,
						entity: IntegrationEntity.SCREENSHOT,
						organizationId
					})
				);
			}
		);

		return await Promise.all(integrationMaps);
	}

	private async _getUpworkAuthenticatedUser(config: IUpworkApiConfig) {
		const api = new UpworkApi(config);
		const users = new Users(api);

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				users.getMyInfo((err, data) => (err ? reject(err) : resolve(data)));
			});
		});
	}

	private async _getUpworkUserInfo(config: IUpworkApiConfig) {
		const api = new UpworkApi(config);
		const auth = new Auth(api);

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				auth.getUserInfo((err, data) => (err ? reject(err) : resolve(data)));
			});
		});
	}

	private async _handleEmployee({ integrationId, organizationId, config }) {
		const promises = [];
		promises.push(this._getUpworkAuthenticatedUser(config));
		promises.push(this._getUpworkUserInfo(config));

		return Promise.all(promises).then(async (results: any[]) => {
			const { user } = results[0];
			const { info } = results[1];
			user['info'] = info;

			return await this.syncEmployee({
				integrationId,
				user,
				organizationId
			});
		});
	}

	private async _getUpworkGauzyEmployee(
		providerReferenceId: string,
		integrationId: string,
		organizationId: string,
		config: IUpworkApiConfig
	) {
		const tenantId = RequestContext.currentTenantId();
		const { record } = await this._integrationMapService.findOneOrFailByOptions({
			where: {
				sourceId: providerReferenceId,
				entity: IntegrationEntity.EMPLOYEE,
				organizationId,
				tenantId
			}
		});

		return record
			? record
			: await this._handleEmployee({
					integrationId,
					organizationId,
					config
				});
	}

	async syncEmployee({ integrationId, user, organizationId }) {
		const tenantId = RequestContext.currentTenantId();

		const { reference: userId, email, info } = user;
		const { record } = await this._userService.findOneOrFailByOptions({
			where: {
				email,
				tenantId
			}
		});

		//upwork profile picture
		const { portrait_100_img: imageUrl } = info;

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

			const { first_name: firstName, last_name: lastName, status } = user;
			const isActive = status === 'active' || false;

			employee = await this._commandBus.execute(
				new EmployeeCreateCommand({
					user: {
						email,
						firstName,
						lastName,
						role,
						tags: null,
						tenant: null,
						imageUrl,
						tenantId,
						preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
					},
					password: environment.defaultIntegratedUserPass,
					organization,
					tenantId,
					startedWorkOn: new Date(moment().format('YYYY-MM-DD HH:mm:ss')),
					isActive
				})
			);
		}

		return await this._commandBus.execute(
			new IntegrationMapSyncEntityCommand({
				gauzyId: employee.id,
				integrationId,
				sourceId: userId,
				entity: IntegrationEntity.EMPLOYEE,
				organizationId
			})
		);
	}

	/**
	 * Sync contract client
	 */
	async syncClient(integrationId: string, organizationId: string, client: any): Promise<IIntegrationMap> {
		const tenantId = RequestContext.currentTenantId();
		const { company_id: sourceId, company_name: name } = client;

		const { record } = await this._integrationMapService.findOneOrFailByOptions({
			where: {
				sourceId,
				entity: IntegrationEntity.CLIENT,
				organizationId,
				tenantId
			}
		});
		if (record) {
			return record;
		}

		const gauzyClient = await this._commandBus.execute(
			new OrganizationContactCreateCommand({
				name,
				organizationId,
				contactType: ContactType.CLIENT,
				tenantId
			})
		);
		return await this._commandBus.execute(
			new IntegrationMapSyncEntityCommand({
				gauzyId: gauzyClient.id,
				integrationId,
				sourceId,
				entity: IntegrationEntity.CLIENT,
				organizationId
			})
		);
	}

	/*
	 * Sync upwork transactions/earnings reports
	 */
	async syncReports(
		organizationId: string,
		integrationId: string,
		config: IUpworkApiConfig,
		employeeId: string,
		providerReferenceId: string,
		providerId: string,
		dateRange: IUpworkDateRange
	) {
		try {
			const syncedIncome = await this._syncIncome(
				organizationId,
				integrationId,
				config,
				employeeId,
				providerId,
				dateRange
			);
			const syncedExpense = await this._syncExpense(
				organizationId,
				integrationId,
				config,
				employeeId,
				providerReferenceId,
				dateRange
			);
			return {
				syncedIncome,
				syncedExpense
			};
		} catch (error) {
			throw new BadRequestException(
				error,
				`Can\'t sync reports for ${IntegrationEntity.INCOME} and ${IntegrationEntity.EXPENSE}`
			);
		}
	}

	/*
	 * Sync upwork freelancer expense
	 */
	private async _syncExpense(
		organizationId: string,
		integrationId: string,
		config: IUpworkApiConfig,
		employeeId: string,
		providerReferenceId: string,
		dateRange: IUpworkDateRange
	) {
		const reports = await this._upworkReportService.getEarningReportByFreelancer(
			config,
			providerReferenceId,
			dateRange
		);
		const {
			table: { cols = [] }
		} = reports;
		let {
			table: { rows = [] }
		} = reports;

		const columns = pluck(cols, 'label');
		//mapped inner row and associate to object key
		rows = map(rows, function (row) {
			const innerRow = pluck(row['c'], 'v');
			const ele = {};
			for (let index = 0; index < columns.length; index++) {
				ele[columns[index]] = innerRow[index];
			}
			return ele;
		});

		return await Promise.all(
			rows
				.filter(({ subtype }) => subtype === ExpenseCategoriesEnum.SERVICE_FEE)
				.map(async (row: any) => {
					const { amount, date, description, subtype, reference } = row;

					const category = await this._commandBus.execute(
						new ExpenseCategoryFirstOrCreateCommand({
							name: ExpenseCategoriesEnum.SERVICE_FEE,
							organizationId
						})
					);
					const vendor = await this._commandBus.execute(
						new OrganizationVendorFirstOrCreateCommand({
							name: OrganizationVendorEnum.UPWORK,
							organizationId
						})
					);

					const { record: integrationMap } = await this._integrationMapService.findOneOrFailByOptions({
						where: {
							integrationId,
							sourceId: reference,
							entity: IntegrationEntity.EXPENSE,
							organizationId
						}
					});

					if (integrationMap) {
						return integrationMap;
					}

					const gauzyExpense = await this._commandBus.execute(
						new ExpenseCreateCommand({
							employeeId,
							organizationId,
							amount,
							category,
							valueDate: new Date(moment(date).format('YYYY-MM-DD HH:mm:ss')),
							vendor,
							reference,
							notes: description,
							typeOfExpense: subtype,
							currency: environment.defaultCurrency
						})
					);

					return await this._commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: gauzyExpense.id,
							integrationId,
							sourceId: reference,
							entity: IntegrationEntity.EXPENSE,
							organizationId
						})
					);
				})
		);
	}

	/*
	 * Sync upwork freelancer income
	 */
	private async _syncIncome(
		organizationId: string,
		integrationId: string,
		config: IUpworkApiConfig,
		employeeId: string,
		providerId: string,
		dateRange: IUpworkDateRange
	) {
		try {
			const reports = await this._upworkReportService.getFullReportByFreelancer(config, providerId, dateRange);
			const {
				table: { cols = [] }
			} = reports;
			let {
				table: { rows = [] }
			} = reports;

			const columns = pluck(cols, 'label');
			//mapped inner row and associate to object key
			rows = map(rows, function (row) {
				const innerRow = pluck(row['c'], 'v');
				const ele = {};
				for (let index = 0; index < columns.length; index++) {
					ele[columns[index]] = innerRow[index];
				}
				return ele;
			});

			let integratedIncomes = [];
			for await (const row of rows) {
				const { memo: notes, worked_on, assignment_rate, hours, assignment_ref: contractId } = row;

				//sync upwork contract client
				const client: IIntegrationMap = await this.syncClient(integrationId, organizationId, row);
				const { record: income } = await this._incomeService.findOneOrFailByOptions({
					where: {
						employeeId,
						clientId: client.gauzyId,
						reference: contractId,
						valueDate: new Date(moment(worked_on).format('YYYY-MM-DD HH:mm:ss')),
						organizationId
					}
				});

				if (income) {
					const { record } = await this._integrationMapService.findOneOrFailByOptions({
						where: {
							gauzyId: income.id,
							integrationId,
							entity: IntegrationEntity.INCOME,
							organizationId
						}
					});
					integratedIncomes.push(record);
				} else {
					const amount = parseFloat((parseFloat(hours) * parseFloat(assignment_rate)).toFixed(2));
					const tenantId = RequestContext.currentTenantId();
					const gauzyIncome = await this._commandBus.execute(
						new IncomeCreateCommand({
							employeeId,
							organizationId,
							tenantId,
							amount,
							valueDate: new Date(moment(worked_on).format('YYYY-MM-DD HH:mm:ss')),
							notes,
							tags: [],
							clientId: client.gauzyId,
							reference: contractId,
							currency: environment.defaultCurrency
						})
					);
					integratedIncomes.push(
						await this._commandBus.execute(
							new IntegrationMapSyncEntityCommand({
								gauzyId: gauzyIncome.id,
								integrationId,
								sourceId: contractId,
								entity: IntegrationEntity.INCOME,
								organizationId
							})
						)
					);
				}
			}
			return integratedIncomes;
		} catch (error) {
			throw new BadRequestException(error, `Can\'t sync ${IntegrationEntity.INCOME}`);
		}
	}

	/**
	 * Get all reports for upwork integration
	 */
	async getReportListByIntegration(integrationId: string, filter, relations): Promise<IPagination<any>> {
		const { organizationId, tenantId } = filter;
		const { items, total } = await this._integrationMapService.findAll({
			where: {
				integration: {
					id: integrationId
				},
				entity: In([IntegrationEntity.INCOME, IntegrationEntity.EXPENSE]),
				organizationId,
				tenantId
			}
		});

		const reports = {
			items: [],
			total
		};
		if (items.length === 0) {
			return reports;
		}

		const gauzyIds = pluck(items, 'gauzyId');
		const {
			dateRange: { start, end }
		} = filter;

		const income = await this._incomeService.findAll({
			where: {
				id: In(gauzyIds),
				valueDate: Between<Date>(
					moment(moment(start).format('YYYY-MM-DD hh:mm:ss')).toDate(),
					moment(moment(end).format('YYYY-MM-DD hh:mm:ss')).toDate()
				),
				organizationId,
				tenantId
			},
			relations: relations.income
		});
		const expense = await this._expenseService.findAll({
			where: {
				id: In(gauzyIds),
				valueDate: Between<Date>(
					moment(moment(start).format('YYYY-MM-DD hh:mm:ss')).toDate(),
					moment(moment(end).format('YYYY-MM-DD hh:mm:ss')).toDate()
				),
				organizationId,
				tenantId
			},
			relations: relations.expense
		});

		reports.total = income.total + expense.total;
		reports.items = reports.items.concat(income.items);
		reports.items = reports.items.concat(expense.items);

		reports.items = sortBy(reports.items, function (item) {
			return item.valueDate;
		}).reverse();

		return reports;
	}

	/*
	 * Sync upwork offers for freelancer
	 */
	async syncProposalsOffers(
		organizationId: string,
		integrationId: string,
		config: IUpworkApiConfig,
		employeeId: string
	) {
		const proposals = await this._getProposals(config);
		const offers = await this._getOffers(config);

		const syncedOffers = await this._syncOffers(config, offers, organizationId, integrationId, employeeId);

		const syncedProposals = await this._syncProposals(proposals);
		return {
			syncedOffers,
			syncedProposals
		};
	}

	/*
	 * Sync upwork proposals for freelancer
	 */
	private async _getProposals(config: IUpworkApiConfig) {
		try {
			const promises = [];
			for (const status in IUpworkProposalStatusEnum) {
				if (isNaN(Number(status))) {
					promises.push(
						this._upworkOfferService
							.getProposalLisByFreelancer(config, IUpworkProposalStatusEnum[status])
							.then((response) => response)
							.catch((error) => error)
					);
				}
			}
			return Promise.all(promises).then(async (results: any[]) => {
				return results;
			});
		} catch (error) {
			throw new BadRequestException('Cannot sync proposals');
		}
	}

	/*
	 * Sync upwork offers for freelancer
	 */
	private async _getOffers(config: IUpworkApiConfig) {
		try {
			const promises = [];
			for (const status in IUpworkOfferStatusEnum) {
				if (isNaN(Number(status))) {
					promises.push(
						this._upworkOfferService
							.getOffersListByFreelancer(config, IUpworkOfferStatusEnum[status])
							.then((response) => response)
							.catch((error) => error)
					);
				}
			}
			return Promise.all(promises).then(async (results: any[]) => {
				return results;
			});
		} catch (error) {
			throw new BadRequestException('Cannot sync offers');
		}
	}

	/*
	 * Sync upwork offers for freelancer
	 */
	private async _syncOffers(
		config: IUpworkApiConfig,
		offers,
		organizationId: string,
		integrationId: string,
		employeeId: string
	) {
		return await Promise.all(
			offers
				.filter((row) => row['offers'] && row['offers'].hasOwnProperty('offer'))
				.map((row) => row['offers'])
				.map(async (row) => {
					const { offer: items } = row;
					let integratedOffers = [];

					for await (const item of items) {
						const {
							title: proposalContent,
							terms_data,
							last_event_state,
							job_posting_ref,
							rid: sourceId
						} = item;
						let { title: jobPostContent } = item;
						//find upwork job
						const job = await this._upworkJobService
							.getJobProfileByKey(config, job_posting_ref)
							.then((response) => response)
							.catch((error) => error);

						//if job not found/closed
						if (job.statusCode !== 400) {
							const { profile } = job;
							jobPostContent = profile['op_description'];
						}

						const tenantId = RequestContext.currentTenantId();
						const integrationMap = await this._integrationMapService.findOneOrFailByOptions({
							where: {
								sourceId,
								entity: IntegrationEntity.PROPOSAL,
								organizationId,
								tenantId
							}
						});

						let integratedOffer;
						if (integrationMap && integrationMap['success'] === true) {
							integratedOffer = integrationMap.record;
						} else {
							const gauzyOffer = await this._commandBus.execute(
								new ProposalCreateCommand({
									employeeId,
									organizationId,
									valueDate: new Date(unixTimestampToDate(terms_data.start_date)),
									status: last_event_state.trim().toUpperCase(),
									proposalContent,
									jobPostContent,
									jobPostUrl: job_posting_ref
								})
							);

							integratedOffer = await this._commandBus.execute(
								new IntegrationMapSyncEntityCommand({
									gauzyId: gauzyOffer.id,
									integrationId,
									sourceId,
									entity: IntegrationEntity.PROPOSAL,
									organizationId
								})
							);
						}

						integratedOffers = integratedOffers.concat(integratedOffer);
					}
					return integratedOffers;
				})
		);
	}

	/*
	 * Sync upwork proposals for freelancer
	 */
	private async _syncProposals(proposals) {
		return await Promise.all(
			proposals
				.filter((row) => row['data'] && row['data'].hasOwnProperty('applications'))
				.map((row) => row.data.applications)
				.map(async (row) => row)
		);
	}
}
