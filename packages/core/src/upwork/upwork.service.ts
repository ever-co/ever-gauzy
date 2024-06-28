import { Injectable, BadRequestException } from '@nestjs/common';
import { In, Between } from 'typeorm';
import { CommandBus } from '@nestjs/cqrs';
import * as UpworkApi from 'upwork-api';
import { pluck, map, sortBy } from 'underscore';
import { environment } from '@gauzy/config';
import { isEmpty, isNotEmpty, isObject } from '@gauzy/common';
import {
	IAccessTokenSecretPair,
	IAccessToken,
	IAccessTokenDto,
	IntegrationEnum,
	IGetContractsDto,
	IGetWorkDiaryDto,
	IEngagement,
	IUpworkApiConfig,
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
	ITimeLog
} from '@gauzy/contracts';
import { IntegrationTenantUpdateOrCreateCommand, IntegrationTenantGetCommand } from '../integration-tenant/commands';
import {
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand,
	IntegrationSettingCreateCommand
} from '../integration-setting/commands';
import { arrayToObject, mergeOverlappingDateRanges, unixTimestampToDate } from '../core/utils';
import { Engagements } from 'upwork-api/lib/routers/hr/engagements.js';
import { Workdiary } from 'upwork-api/lib/routers/workdiary.js';
import { Snapshot } from 'upwork-api/lib/routers/snapshot.js';
import { Auth } from 'upwork-api/lib/routers/auth.js';
import { Users } from 'upwork-api/lib/routers/organization/users.js';
import { IntegrationMapSyncEntityCommand } from '../integration-map/commands';
import * as moment from 'moment';
import { OrganizationProjectCreateCommand, OrganizationProjectUpdateCommand } from '../organization-project/commands';
import { EmployeeGetCommand } from '../employee/commands/employee.get.command';
import { EmployeeCreateCommand } from '../employee/commands';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import { UserService } from '../user/user.service';
import { OrganizationService } from '../organization/organization.service';
import { RoleService } from '../role/role.service';
import { TimeSlotService } from '../time-tracking/time-slot/time-slot.service';
import { ExpenseService } from '../expense/expense.service';
import { IncomeService } from '../income/income.service';
import { IncomeCreateCommand } from '../income/commands';
import { ExpenseCreateCommand } from '../expense/commands';
import { OrganizationContactCreateCommand } from '../organization-contact/commands';
import { UpworkJobService, UpworkOffersService, UpworkReportService } from '@gauzy/integration-upwork';
import { TimeLogCreateCommand } from '../time-tracking/time-log/commands';
// import { ProposalCreateCommand } from '../proposal/commands/proposal-create.command';
import { CreateTimeSlotMinutesCommand, TimeSlotCreateCommand } from './../time-tracking/time-slot/commands';
import { RequestContext } from '../core/context';
import { ScreenshotCreateCommand } from './../time-tracking/screenshot/commands';
import { OrganizationVendorFirstOrCreateCommand } from './../organization-vendor/commands';
import { ExpenseCategoryFirstOrCreateCommand } from './../expense-categories/commands';

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
		private readonly commandBus: CommandBus
	) {}

	private async _consumerHasAccessToken(config: IUpworkClientSecretPair, organizationId: string) {
		const integrationSetting = await this.commandBus.execute(
			new IntegrationSettingGetCommand({
				where: {
					settingsValue: config.consumerKey,
					organizationId: organizationId
				},
				relations: ['integration']
			})
		);
		if (!integrationSetting) {
			return false;
		}

		const integrationSettings = await this.commandBus.execute(
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
			return {
				integrationId: integrationSetting.integration.id,
				...integrationSettingMap
			};
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
			return consumerAccessToken;
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

				await this.commandBus.execute(
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
				return resolve({
					url,
					requestToken,
					requestTokenSecret,
					organizationId
				});
			});
		});
	}

	getAccessToken({ requestToken, verifier }: IAccessTokenDto, organizationId: string): Promise<IAccessToken> {
		return new Promise(async (resolve, reject) => {
			const { integration } = await this.commandBus.execute(
				new IntegrationSettingGetCommand({
					where: {
						settingsValue: requestToken,
						organizationId
					},
					relations: ['integration']
				})
			);
			const integrationSettings = await this.commandBus.execute(
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
					await this.commandBus.execute(
						new IntegrationSettingCreateCommand({
							integration,
							settingsName: 'accessToken',
							settingsValue: accessToken,
							organizationId
						})
					);
					await this.commandBus.execute(
						new IntegrationSettingCreateCommand({
							integration,
							settingsName: 'accessTokenSecret',
							settingsValue: accessTokenSecret,
							organizationId
						})
					);

					resolve({
						integrationId: integration.id,
						accessToken,
						accessTokenSecret
					});
				}
			);
		});
	}

	async getConfig(integrationId: string, filter): Promise<IUpworkApiConfig> {
		const { organizationId, tenantId } = filter;
		const integration = await this.commandBus.execute(
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
		const integrationSettings = await this.commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: {
					integration,
					organizationId
				}
			})
		);
		const {
			accessToken,
			consumerKey,
			consumerSecret,
			accessTokenSecret: accessSecret
		} = arrayToObject(integrationSettings, 'settingsName', 'settingsValue');

		return { accessToken, consumerKey, consumerSecret, accessSecret };
	}

	// engagement has access to contract ID, this is a project in gauzy
	async getContractsForFreelancer(getEngagementsDto: IGetContractsDto): Promise<IEngagement[]> {
		// console.log(`Call Upwork API using accessToken: ${getEngagementsDto.config.accessToken}, accessSecret: ${getEngagementsDto.config.accessSecret}`);

		const api = new UpworkApi(getEngagementsDto.config);
		const engagements = new Engagements(api);
		const params = {};
		return new Promise((resolve, reject) => {
			api.setAccessToken(getEngagementsDto.config.accessToken, getEngagementsDto.config.accessSecret, () => {
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
					const payload = {
						name,
						organizationId,
						public: true,
						currency: environment.defaultCurrency as CurrenciesEnum
					};

					if (isObject(active_milestone)) {
						payload['billing'] = ProjectBillingEnum.MILESTONES;
					} else {
						payload['billing'] = ProjectBillingEnum.RATE;
					}

					// contract start date
					if (typeof engagement_start_date === 'string' && engagement_start_date.length > 0) {
						payload['startDate'] = new Date(unixTimestampToDate(engagement_start_date));
					}
					// contract end date
					if (typeof engagement_end_date === 'string' && engagement_end_date.length > 0) {
						payload['endDate'] = new Date(unixTimestampToDate(engagement_end_date));
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
						await this.commandBus.execute(
							new OrganizationProjectUpdateCommand(
								Object.assign(payload, {
									id: integrationMap.gauzyId
								})
							)
						);
						return integrationMap;
					}
					const project = await this.commandBus.execute(
						new OrganizationProjectCreateCommand(Object.assign({}, payload))
					);
					return await this.commandBus.execute(
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

	// work diary holds information for time slots and time logs
	async getWorkDiary(getWorkDiaryDto: IGetWorkDiaryDto): Promise<any> {
		const api = new UpworkApi(getWorkDiaryDto.config);
		const workdiary = new Workdiary(api);
		const params = {
			offset: 0
		};
		return new Promise((resolve, reject) => {
			api.setAccessToken(getWorkDiaryDto.config.accessToken, getWorkDiaryDto.config.accessSecret, () => {
				workdiary.getByContract(
					getWorkDiaryDto.contractId,
					moment(getWorkDiaryDto.forDate).format('YYYYMMDD'),
					params,
					(err, data) => (err ? reject(err) : resolve(data))
				);
			});
		});
	}

	async syncTimeLog(timeLog): Promise<ITimeLog> {
		const organizationId = timeLog.organizationId;
		const tenantId = RequestContext.currentTenantId();

		const gauzyTimeLog = await this.commandBus.execute(
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

		await this.commandBus.execute(
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
			const gauzyTimeSlot = await this.commandBus.execute(
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
			const integratedSlot = await this.commandBus.execute(
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
				const wd = await this.getWorkDiary({
					contractId: contract.sourceId,
					config,
					forDate
				})
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

	async syncContractsRelatedData({
		integrationId,
		organizationId,
		contracts,
		employeeId,
		config,
		entitiesToSync,
		providerReferenceId,
		providerId
	}) {
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
					// case 'proposal':
					// 	return await this.syncProposalsOffers(
					// 		organizationId,
					// 		integrationId,
					// 		config,
					// 		employeeId
					// 	);
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
					const { record: findTimeSlot } = await this._timeSlotService.findOneOrFailByOptions({
						where: {
							tenantId,
							employeeId,
							startedAt: moment(moment.unix(cell_time).format('YYYY-MM-DD HH:mm:ss')).toDate()
						}
					});

					if (!findTimeSlot) {
						return;
					}

					const { time, mouse, keyboard } = minute;
					const gauzyTimeSlotMinute = await this.commandBus.execute(
						new CreateTimeSlotMinutesCommand({
							mouse,
							keyboard,
							datetime: new Date(moment.unix(time).format('YYYY-MM-DD HH:mm:ss')),
							timeSlot: findTimeSlot,
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

				const gauzyScreenshot = await this.commandBus.execute(
					new ScreenshotCreateCommand({
						file: screenshot_img,
						thumb: screenshot_img_thmb,
						recordedAt,
						activityTimestamp,
						employeeId,
						organizationId
					})
				);

				return await this.commandBus.execute(
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
			employee = await this.commandBus.execute(new EmployeeGetCommand({ where: { userId: record.id } }));
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

			employee = await this.commandBus.execute(
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

		return await this.commandBus.execute(
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

		const gauzyClient = await this.commandBus.execute(
			new OrganizationContactCreateCommand({
				name,
				organizationId,
				contactType: ContactType.CLIENT,
				tenantId
			})
		);
		return await this.commandBus.execute(
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

					const category = await this.commandBus.execute(
						new ExpenseCategoryFirstOrCreateCommand({
							name: ExpenseCategoriesEnum.SERVICE_FEE,
							organizationId
						})
					);
					const vendor = await this.commandBus.execute(
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

					const gauzyExpense = await this.commandBus.execute(
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

					return await this.commandBus.execute(
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
					const gauzyIncome = await this.commandBus.execute(
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
						await this.commandBus.execute(
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
	// async syncProposalsOffers(
	// 	organizationId: string,
	// 	integrationId: string,
	// 	config: IUpworkApiConfig,
	// 	employeeId: string
	// ) {
	// 	const proposals = await this._getProposals(config);
	// 	const offers = await this._getOffers(config);

	// 	const syncedOffers = await this._syncOffers(
	// 		config,
	// 		offers,
	// 		organizationId,
	// 		integrationId,
	// 		employeeId
	// 	);

	// 	const syncedProposals = await this._syncProposals(proposals);
	// 	return {
	// 		syncedOffers,
	// 		syncedProposals
	// 	};
	// }

	/*
	 * Sync upwork proposals for freelancer
	 */
	// private async _getProposals(config: IUpworkApiConfig) {
	// 	try {
	// 		const promises = [];
	// 		for (const status in IUpworkProposalStatusEnum) {
	// 			if (isNaN(Number(status))) {
	// 				promises.push(
	// 					this._upworkOfferService
	// 						.getProposalLisByFreelancer(
	// 							config,
	// 							IUpworkProposalStatusEnum[status]
	// 						)
	// 						.then((response) => response)
	// 						.catch((error) => error)
	// 				);
	// 			}
	// 		}
	// 		return Promise.all(promises).then(async (results: any[]) => {
	// 			return results;
	// 		});
	// 	} catch (error) {
	// 		throw new BadRequestException('Cannot sync proposals');
	// 	}
	// }

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
	// private async _syncOffers(
	// 	config: IUpworkApiConfig,
	// 	offers,
	// 	organizationId: string,
	// 	integrationId: string,
	// 	employeeId: string
	// ) {
	// 	return await Promise.all(
	// 		offers
	// 			.filter(
	// 				(row) =>
	// 					row['offers'] && row['offers'].hasOwnProperty('offer')
	// 			)
	// 			.map((row) => row['offers'])
	// 			.map(async (row) => {
	// 				const { offer: items } = row;
	// 				let integratedOffers = [];

	// 				for await (const item of items) {
	// 					const {
	// 						title: proposalContent,
	// 						terms_data,
	// 						last_event_state,
	// 						job_posting_ref,
	// 						rid: sourceId
	// 					} = item;
	// 					let { title: jobPostContent } = item;
	// 					//find upwork job
	// 					const job = await this._upworkJobService
	// 						.getJobProfileByKey(config, job_posting_ref)
	// 						.then((response) => response)
	// 						.catch((error) => error);

	// 					//if job not found/closed
	// 					if (job.statusCode !== 400) {
	// 						const { profile } = job;
	// 						jobPostContent = profile['op_description'];
	// 					}

	// 					const tenantId = RequestContext.currentTenantId();
	// 					const integrationMap = await this._integrationMapService.findOneOrFailByOptions(
	// 						{
	// 							where: {
	// 								sourceId,
	// 								entity: IntegrationEntity.PROPOSAL,
	// 								organizationId,
	// 								tenantId
	// 							}
	// 						}
	// 					);

	// 					let integratedOffer;
	// 					if (
	// 						integrationMap &&
	// 						integrationMap['success'] === true
	// 					) {
	// 						integratedOffer = integrationMap.record;
	// 					} else {
	// 						const gauzyOffer = await this.commandBus.execute(
	// 							new ProposalCreateCommand({
	// 								employeeId,
	// 								organizationId,
	// 								valueDate: new Date(
	// 									unixTimestampToDate(
	// 										terms_data.start_date
	// 									)
	// 								),
	// 								status: last_event_state
	// 									.trim()
	// 									.toUpperCase(),
	// 								proposalContent,
	// 								jobPostContent,
	// 								jobPostUrl: job_posting_ref
	// 							})
	// 						);

	// 						integratedOffer = await this.commandBus.execute(
	// 							new IntegrationMapSyncEntityCommand({
	// 								gauzyId: gauzyOffer.id,
	// 								integrationId,
	// 								sourceId,
	// 								entity: IntegrationEntity.PROPOSAL,
	// 								organizationId
	// 							})
	// 						);
	// 					}

	// 					integratedOffers = integratedOffers.concat(
	// 						integratedOffer
	// 					);
	// 				}
	// 				return integratedOffers;
	// 			})
	// 	);
	// }

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
