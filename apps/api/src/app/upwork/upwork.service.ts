import { Injectable, BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import * as UpworkApi from 'upwork-api';
import * as _ from 'underscore';
import { environment } from '@env-api/environment';
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
	OrganizationVendorEnum
} from '@gauzy/models';
import {
	IntegrationTenantCreateCommand,
	IntegrationTenantGetCommand
} from '../integration-tenant/commands';
import {
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand,
	IntegrationSettingCreateCommand
} from '../integration-setting/commands';
import { arrayToObject } from '../core';
import { Companies } from 'upwork-api/lib/routers/organization/companies.js';
import { Engagements } from 'upwork-api/lib/routers/hr/engagements.js';
import { Workdiary } from 'upwork-api/lib/routers/workdiary.js';
import { Snapshot } from 'upwork-api/lib/routers/snapshot.js';
import { Auth } from 'upwork-api/lib/routers/auth.js';
import { Users } from 'upwork-api/lib/routers/organization/users.js';
import { Time } from 'upwork-api/lib/routers/reports/time.js';
import { Accounts } from 'upwork-api/lib/routers/reports/finance/accounts.js';
import { Earnings } from 'upwork-api/lib/routers/reports/finance/earnings.js';
import { Billings } from 'upwork-api/lib/routers/reports/finance/billings.js';
import { IntegrationMapSyncEntityCommand } from '../integration-map/commands';
import {
	TimesheetGetCommand,
	TimesheetCreateCommand,
	TimeLogCreateCommand,
	TimeSlotCreateCommand,
	ScreenshotCreateCommand,
	TimeSlotMinuteCreateCommand
} from '../timesheet/commands';
import * as moment from 'moment';
import { OrganizationProjectCreateCommand } from '../organization-projects/commands/organization-project.create.command';
import { EmployeeGetCommand } from '../employee/commands/employee.get.command';
import { EmployeeCreateCommand } from '../employee/commands';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import { UserService } from '../user/user.service';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationVendorsService } from '../organization-vendors/organization-vendors.service';
import { RoleService } from '../role/role.service';
import { TimeSlotService } from '../timesheet/time-slot/time-slot.service';
import { ExpenseCategoriesService } from '../expense-categories/expense-categories.service';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { IncomeCreateCommand } from '../income/commands/income.create.command';
import { ExpenseCreateCommand } from '../expense/commands/expense.create.command';
import { OrganizationContactCreateCommand } from '../organization-contact/commands/organization-contact-create.commant';

@Injectable()
export class UpworkService {
	private _upworkApi: UpworkApi;

	constructor(
		private _expenseCategoryService: ExpenseCategoriesService,
		private _integrationMapService: IntegrationMapService,
		private _userService: UserService,
		private _roleService: RoleService,
		private _organizationService: OrganizationService,
		private _orgVendorService: OrganizationVendorsService,
		private _orgClientService: OrganizationContactService,
		private _timeSlotService: TimeSlotService,
		private commandBus: CommandBus
	) {}

	private async _consumerHasAccessToken(consumerKey: string) {
		const integrationSetting = await this.commandBus.execute(
			new IntegrationSettingGetCommand({
				where: { settingsValue: consumerKey },
				relations: ['integration']
			})
		);
		if (!integrationSetting) {
			return false;
		}

		const integrationSettings = await this.commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: { integration: integrationSetting.integration }
			})
		);
		const integrationSettingMap = arrayToObject(
			integrationSettings,
			'settingsName',
			'settingsValue'
		);

		if (
			integrationSettingMap.accessToken &&
			integrationSettingMap.accessTokenSecret
		) {
			return {
				integrationId: integrationSetting.integration.id,
				...integrationSettingMap
			};
		}

		return false;
	}

	async getAccessTokenSecretPair(config): Promise<IAccessTokenSecretPair> {
		const consumerAcessToken = await this._consumerHasAccessToken(
			config.consumerKey
		);

		// access token live forever, if user already registered app, retern the access token;
		if (consumerAcessToken) {
			return consumerAcessToken;
		}

		this._upworkApi = new UpworkApi(config);

		return new Promise((resolve, reject) => {
			this._upworkApi.getAuthorizationUrl(
				environment.upworkConfig.callbackUrl,
				async (error, url, requestToken, requestTokenSecret) => {
					if (error)
						reject(`can't get authorization url, error: ${error}`);

					await this.commandBus.execute(
						new IntegrationTenantCreateCommand({
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
							]
						})
					);
					return resolve({ url, requestToken, requestTokenSecret });
				}
			);
		});
	}

	getAccessToken({
		requestToken,
		verifier
	}: IAccessTokenDto): Promise<IAccessToken> {
		return new Promise(async (resolve, reject) => {
			const { integration } = await this.commandBus.execute(
				new IntegrationSettingGetCommand({
					where: { settingsValue: requestToken },
					relations: ['integration']
				})
			);

			const integrationSettings = await this.commandBus.execute(
				new IntegrationSettingGetManyCommand({
					where: { integration }
				})
			);
			const integrationSetting = arrayToObject(
				integrationSettings,
				'settingsName',
				'settingsValue'
			);

			this._upworkApi.getAccessToken(
				requestToken,
				integrationSetting.requestTokenSecret,
				verifier,
				async (error, accessToken, accessTokenSecret) => {
					if (error) reject(new Error(error));
					await this.commandBus.execute(
						new IntegrationSettingCreateCommand({
							integration,
							settingsName: 'accessToken',
							settingsValue: accessToken
						})
					);
					await this.commandBus.execute(
						new IntegrationSettingCreateCommand({
							integration,
							settingsName: 'accessTokenSecret',
							settingsValue: accessTokenSecret
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

	async getConfig(integrationId): Promise<IUpworkApiConfig> {
		const integration = await this.commandBus.execute(
			new IntegrationTenantGetCommand({ where: { id: integrationId } })
		);
		const integrationSettings = await this.commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: { integration }
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
	async getContractsForFreelancer(
		getEngagementsDto: IGetContractsDto
	): Promise<IEngagement[]> {
		const api = new UpworkApi(getEngagementsDto.config);
		const engagements = new Engagements(api);
		const params = {};
		return new Promise((resolve, reject) => {
			api.setAccessToken(
				getEngagementsDto.config.accessToken,
				getEngagementsDto.config.accessSecret,
				() => {
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
				}
			);
		});
	}

	/*
	 * Get specific contract using contractId
	 */
	private async _getContractByContractId(
		config: IUpworkApiConfig,
		contractId
	): Promise<IEngagement> {
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

	async syncContracts({
		integrationId,
		organizationId,
		contracts
	}): Promise<IIntegrationMap[]> {
		return await Promise.all(
			await contracts.map(
				async ({ job__title: name, reference: sourceId }) => {
					const project = await this.commandBus.execute(
						new OrganizationProjectCreateCommand({
							name,
							organizationId,
							public: true,
							billing: ProjectBillingEnum.RATE,
							currency: CurrenciesEnum.BGN
						})
					);

					return await this.commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: project.id,
							integrationId,
							sourceId,
							entity: IntegrationEntity.PROJECT
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
			api.setAccessToken(
				getWorkDiaryDto.config.accessToken,
				getWorkDiaryDto.config.accessSecret,
				() => {
					workdiary.getByContract(
						getWorkDiaryDto.contractId,
						moment(getWorkDiaryDto.forDate).format('YYYYMMDD'),
						params,
						(err, data) => (err ? reject(err) : resolve(data))
					);
				}
			);
		});
	}

	async syncTimeLog(timeLog) {
		let timesheet = await this.commandBus.execute(
			new TimesheetGetCommand({
				where: { employeeId: timeLog.employeeId }
			})
		);

		if (!timesheet) {
			timesheet = await this.commandBus.execute(
				new TimesheetCreateCommand({
					startedAt: timeLog.startDate,
					employeeId: timeLog.employeeId,
					mouse: timeLog.mouse_events_count,
					keyboard: timeLog.keyboard_events_count,
					duration: timeLog.duration
				})
			);
		}

		const gauzyTimeLog = await this.commandBus.execute(
			new TimeLogCreateCommand({
				projectId: timeLog.projectId,
				employeeId: timeLog.employeeId,
				logType: timeLog.logType,
				duration: timeLog.duration,
				startedAt: timeLog.startDate,
				timesheetId: timesheet.id
			})
		);

		await this.commandBus.execute(
			new IntegrationMapSyncEntityCommand({
				gauzyId: gauzyTimeLog.id,
				integrationId: timeLog.integrationId,
				sourceId: timeLog.sourceId,
				entity: IntegrationEntity.TIME_LOG
			})
		);

		return gauzyTimeLog;
	}

	async syncTimeSlots({ timeSlots, employeeId, integrationId, sourceId }) {
		let integratedTimeSlots = [];

		for await (const timeSlot of timeSlots) {
			const gauzyTimeSlot = await this.commandBus.execute(
				new TimeSlotCreateCommand({
					employeeId,
					startedAt: new Date(
						moment
							.unix(timeSlot.cell_time)
							.format('YYYY-MM-DD HH:mm:ss')
					),
					keyboard: timeSlot.keyboard_events_count,
					mouse: timeSlot.mouse_events_count,
					time_slot: new Date(
						moment
							.unix(timeSlot.cell_time)
							.format('YYYY-MM-DD HH:mm:ss')
					),
					overall: 0,
					duration: 0
				})
			);

			const integratedSlot = await this.commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: gauzyTimeSlot.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.TIME_SLOT
				})
			);

			integratedTimeSlots = integratedTimeSlots.concat(integratedSlot);
		}

		return integratedTimeSlots;
	}

	async syncWorkDiaries(
		organizationId,
		integrationId,
		syncedContracts,
		config,
		employeeId,
		forDate
	) {
		const workDiaries = await Promise.all(
			syncedContracts.map(async (contract) => {
				const wd = await this.getWorkDiary({
					contractId: contract.sourceId,
					config,
					forDate
				});

				const cells = wd.data.cells;
				const sourceId = wd.data.contract.record_id;

				if (!cells.length) {
					return [];
				}

				const timeLogDto = {
					...this.formatLogFromSlots(cells),
					employeeId,
					integrationId,
					organizationId,
					projectId: contract.gauzyId,
					startDate: moment
						.unix(cells[0].cell_time)
						.format('YYYY-MM-DD HH:mm:ss'),
					duration: cells.length * 10 * 60,
					sourceId
				};

				const timeSlotsDto = {
					timeSlots: cells,
					employeeId,
					integrationId,
					sourceId
				};

				const integratedTimeLog = await this.syncTimeLog(timeLogDto);
				const integratedTimeSlots = await this.syncTimeSlots(
					timeSlotsDto
				);
				const integratedScreenshots = await this.syncSnapshots(
					timeSlotsDto
				);
				const timeSlotsActivities = await this.getTimeSlotActivitiesByContractId(
					{
						contractId: sourceId,
						employeeId,
						config,
						timeSlots: cells
					}
				);

				return {
					integratedTimeLog,
					integratedTimeSlots,
					integratedScreenshots,
					timeSlotsActivities
				};
			})
		);
		return workDiaries;
	}

	formatLogFromSlots(slots) {
		return slots.reduce(
			(prev, current) => {
				return {
					...prev,
					keyboard: prev.keyboard += +current.keyboard_events_count,
					mouse: prev.mouse += +current.mouse_events_count,
					logType: slots.manual
						? TimeLogType.MANUAL
						: TimeLogType.TRACKED
				};
			},
			{
				keyboard: 0,
				mouse: 0
			}
		);
	}

	async syncContractsRelatedData({
		integrationId,
		organizationId,
		contracts,
		employeeId,
		config,
		entitiesToSync,
		providerRefernceId,
		providerId
	}) {
		const syncedContracts = await this.syncContracts({
			contracts,
			integrationId,
			organizationId
		});

		if (!employeeId) {
			const employee = await this._getUpworkGauzyEmployee(
				providerRefernceId,
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
					case 'reports':
						return await this.syncReports(
							organizationId,
							integrationId,
							config,
							employeeId,
							providerRefernceId,
							providerId,
							entity.datePicker.selectedDate
						);
					default:
						return;
				}
			})
		);
	}

	/*
	 * Get timeslot minute activities
	 */
	async syncTimeSlotsActivity({ employeeId, timeSlot, timeSlotActivity }) {
		try {
			const { minutes } = timeSlotActivity;
			const { cell_time } = timeSlot;

			const integratedTimeSlotsMinutes = await Promise.all(
				minutes.map(async (minute) => {
					const {
						record: timeSlot
					} = await this._timeSlotService.findOneOrFail({
						where: {
							employeeId: employeeId,
							startedAt: moment
								.unix(cell_time)
								.format('YYYY-MM-DD HH:mm:ss')
						}
					});

					const { time, mouse, keyboard } = minute;
					const gauzyTimeSlotMinute = await this.commandBus.execute(
						new TimeSlotMinuteCreateCommand({
							mouse,
							keyboard,
							datetime: new Date(
								moment.unix(time).format('YYYY-MM-DD HH:mm:ss')
							),
							timeSlot
						})
					);

					return gauzyTimeSlotMinute;
				})
			);

			return integratedTimeSlotsMinutes;
		} catch (error) {
			throw new BadRequestException(
				'Cannot sync timeslot every minute activity'
			);
		}
	}

	/*
	 * Get snapshots/timeslot minutes activites
	 */
	async getTimeSlotActivitiesByContractId({
		contractId,
		employeeId,
		config,
		timeSlots
	}) {
		const timeSlotActivities = await Promise.all(
			timeSlots.map(async (timeslot) => {
				const {
					snapshot: timeSlotActivity
				} = await this.getSnapshotByContractId(
					config,
					contractId,
					timeslot
				);
				const integratedTimeSlotActivities = await this.syncTimeSlotsActivity(
					{
						employeeId,
						timeSlot: timeslot,
						timeSlotActivity
					}
				);

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
	async getSnapshotByContractId(
		config: IUpworkApiConfig,
		contractId,
		timeSlot
	): Promise<any> {
		const api = new UpworkApi(config);
		const snapshots = new Snapshot(api);
		const { snapshot_time: snapshotTime } = timeSlot;

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				snapshots.getByContract(contractId, snapshotTime, (err, data) =>
					err ? reject(err) : resolve(data)
				);
			});
		});
	}

	/*
	 * Sync Snapshots By Contract
	 */
	async syncSnapshots(timeSlotsData) {
		const {
			timeSlots = [],
			employeeId,
			integrationId,
			sourceId
		} = timeSlotsData;
		const integrationMaps = await timeSlots.map(
			async ({
				id,
				cell_time,
				screenshot_img,
				screenshot_img_thmb,
				snapshot_time
			}) => {
				let recordedAt = moment
					.unix(snapshot_time)
					.format('YYYY-MM-DD HH:mm:ss');
				let activityTimestamp = moment
					.unix(cell_time)
					.format('YYYY-MM-DD HH:mm:ss');

				const gauzyScreenshot = await this.commandBus.execute(
					new ScreenshotCreateCommand({
						fullUrl: screenshot_img,
						thumbUrl: screenshot_img_thmb,
						recordedAt,
						activityTimestamp,
						employeeId
					})
				);

				return await this._integrationMapService.create({
					gauzyId: gauzyScreenshot.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.SCREENSHOT
				});
			}
		);

		return await Promise.all(integrationMaps);
	}

	private async _getUpworkAuthenticatedUser(config: IUpworkApiConfig) {
		const api = new UpworkApi(config);
		const users = new Users(api);

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				users.getMyInfo((err, data) =>
					err ? reject(err) : resolve(data)
				);
			});
		});
	}

	private async _getUpworkUserInfo(config: IUpworkApiConfig) {
		const api = new UpworkApi(config);
		const auth = new Auth(api);

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				auth.getUserInfo((err, data) =>
					err ? reject(err) : resolve(data)
				);
			});
		});
	}

	private async _handleEmployee({ integrationId, organizationId, config }) {
		let promises = [];
		promises.push(this._getUpworkAuthenticatedUser(config));
		promises.push(this._getUpworkUserInfo(config));

		return Promise.all(promises).then(async (results: any[]) => {
			const { user } = results[0];
			let { info } = results[1];
			user['info'] = info;

			return await this.syncEmployee({
				integrationId,
				user,
				organizationId
			});
		});
	}

	private async _getUpworkGauzyEmployee(
		providerRefernceId,
		integrationId,
		organizationId,
		config
	) {
		let { record } = await this._integrationMapService.findOneOrFail({
			where: {
				sourceId: providerRefernceId,
				entity: IntegrationEntity.EMPLOYEE
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
		const { reference: userId, email } = user;
		let { record } = await this._userService.findOneOrFail({
			where: { email: email }
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

			const { first_name: firstName, last_name: lastName } = user;
			employee = await this.commandBus.execute(
				new EmployeeCreateCommand({
					user: {
						email,
						firstName,
						lastName,
						role,
						tags: null,
						tenant: null
					},
					password: environment.defaultHubstaffUserPass,
					organization
				})
			);
		}
		return await this._integrationMapService.create({
			gauzyId: employee.id,
			integrationId,
			sourceId: userId,
			entity: IntegrationEntity.EMPLOYEE
		});
	}

	async syncClient(integrationId, organizationId, client): Promise<any> {
		const { company_id: sourceId, company_name } = client;
		const { record } = await this._orgClientService.findOneOrFail({
			where: {
				name: company_name,
				organizationId: organizationId
			}
		});

		if (!record) {
			const gauzyClient = await this.commandBus.execute(
				new OrganizationContactCreateCommand({
					name,
					organizationId
				})
			);

			await this._integrationMapService.create({
				gauzyId: gauzyClient.id,
				integrationId,
				sourceId,
				entity: IntegrationEntity.CLIENT
			});

			return gauzyClient;
		}

		return record;
	}

	async syncReports(
		organizationId,
		integrationId,
		config,
		employeeId,
		providerRefernceId,
		providerId,
		dateRange
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
				providerRefernceId,
				dateRange
			);
			return {
				syncedIncome,
				syncedExpense
			};
		} catch (error) {
			throw new BadRequestException('Cannot sync reports');
		}
	}

	/*
	 * Upwork freelancer expense
	 */
	private async _syncExpense(
		organizationId,
		integrationId,
		config,
		employeeId,
		providerRefernceId,
		dateRange
	) {
		const reports = await this._getEarningReportsForFreelancer(
			config,
			providerRefernceId,
			dateRange
		);

		var {
			table: { cols = [], rows = [] }
		} = reports;

		const columns = _.pluck(cols, 'label');
		//mapped inner row and associate to object key
		rows = _.map(rows, function (row) {
			const innerRow = _.pluck(row['c'], 'v');
			const ele = {};
			for (let index = 0; index < columns.length; index++) {
				ele[columns[index]] = innerRow[index];
			}
			return ele;
		});

		return await Promise.all(
			rows
				.filter(
					(row) => row.subtype === ExpenseCategoriesEnum.SERVICE_FEE
				)
				.map(async (row) => {
					const { amount, date, description, subtype } = row;
					const {
						record: category
					} = await this._expenseCategoryService.findOneOrFail({
						where: {
							name: ExpenseCategoriesEnum.SERVICE_FEE
						}
					});

					const {
						record: vendor
					} = await this._orgVendorService.findOneOrFail({
						where: {
							name: OrganizationVendorEnum.UPWORK,
							organizationId
						}
					});

					const gauzyExpense = await this.commandBus.execute(
						new ExpenseCreateCommand({
							employeeId,
							orgId: organizationId,
							amount,
							category,
							valueDate: new Date(
								moment(date).format('YYYY-MM-DD hh:mm:ss')
							),
							vendor,
							notes: description,
							typeOfExpense: subtype
						})
					);

					const { assignment__reference: sourceId } = row;
					return await this._integrationMapService.create({
						gauzyId: gauzyExpense.id,
						integrationId,
						sourceId,
						entity: IntegrationEntity.EXPENSE
					});
				})
		);
	}

	/*
	 * Upwork freelancer income
	 */
	private async _syncIncome(
		organizationId,
		integrationId,
		config,
		employeeId,
		providerId,
		dateRange
	) {
		const reports = await this._getFreelancerFullReports(
			config,
			providerId,
			dateRange
		);
		var {
			table: { cols = [], rows = [] }
		} = reports;

		const columns = _.pluck(cols, 'label');
		//mapped inner row and associate to object key
		rows = _.map(rows, function (row) {
			const innerRow = _.pluck(row['c'], 'v');
			const ele = {};
			for (let index = 0; index < columns.length; index++) {
				ele[columns[index]] = innerRow[index];
			}
			return ele;
		});

		return await Promise.all(
			rows.map(async (row) => {
				const {
					company_id: clientId,
					company_name: clientName,
					memo: notes,
					worked_on,
					assignment_rate,
					hours,
					assignment_ref: contractId
				} = row;

				//sync upwork contract client
				const client = await this.syncClient(
					integrationId,
					organizationId,
					row
				);

				const gauzyIncome = await this.commandBus.execute(
					new IncomeCreateCommand({
						employeeId,
						orgId: organizationId,
						clientName,
						clientId,
						amount: parseFloat(hours) * parseFloat(assignment_rate),
						valueDate: new Date(
							moment(worked_on).format('YYYY-MM-DD hh:mm:ss')
						),
						notes,
						tags: [],
						reference: contractId
					})
				);

				return await this._integrationMapService.create({
					gauzyId: gauzyIncome.id,
					integrationId,
					sourceId: contractId,
					entity: IntegrationEntity.INCOME
				});
			})
		);
	}

	/*
	 * Get freelancer limited reports for freelancer
	 */
	private async _getFreelanceLimitedReports(
		config: IUpworkApiConfig,
		providerId
	): Promise<any> {
		const api = new UpworkApi(config);
		const reports = new Time(api);

		const freelancerId = providerId;

		const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
		const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

		const select = `SELECT 
							worked_on,
							company_id,
							company_name, 
							assignment_name, 
							assignment_team_id,
							assignment_ref,
							assignment_rate,
							hours, 
							memo,
							contract_type
						WHERE
							worked_on > '${startOfMonth}' AND 
							worked_on <= '${endOfMonth}',
						ORDER BY 
							worked_on,
							assignment_ref`;

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				reports.getByFreelancerLimited(
					freelancerId,
					{
						tq: select
					},
					(err, data) => (err ? reject(err) : resolve(data))
				);
			});
		});
	}

	/*
	 * Get freelancer reports for client
	 */
	private async _getFreelancerFullReports(
		config: IUpworkApiConfig,
		providerId,
		dateRange
	): Promise<any> {
		const api = new UpworkApi(config);
		const reports = new Time(api);

		const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
		const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

		const select = `SELECT 
							worked_on,
							company_id,
							company_name,
							assignment_name, 
							assignment_team_id,
							assignment_ref,
							assignment_rate,
							hours, 
							memo,
							contract_type
						WHERE 
							worked_on > '${startOfMonth}' AND 
							worked_on <= '${endOfMonth}'
						ORDER BY 
							worked_on,
							assignment_ref`;

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				reports.getByFreelancerFull(
					providerId,
					{
						tq: select
					},
					(err, data) => (err ? reject(err) : resolve(data))
				);
			});
		});
	}

	/*
	 * Get billings reports for freelancer
	 */
	private async _getBillingReportsForFreelancer(
		config: IUpworkApiConfig,
		providerRefernceId
	) {
		const api = new UpworkApi(config);
		const billings = new Billings(api);

		const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
		const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

		const select = `SELECT 
							amount,
							date,
							type,
							subtype
						WHERE 
							date > '${startOfMonth}' AND 
							date <= '${endOfMonth}'`;

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				billings.getByFreelancer(
					providerRefernceId,
					{
						tq: select
					},
					(err, data) => (err ? reject(err) : resolve(data))
				);
			});
		});
	}

	/*
	 * Get earning reports for freelancer
	 */
	private async _getEarningReportsForFreelancer(
		config: IUpworkApiConfig,
		providerRefernceId,
		dateRange
	): Promise<any> {
		const api = new UpworkApi(config);
		const earnings = new Earnings(api);

		const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
		const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

		const select = `SELECT 
							amount,
							date,
							type,
							subtype,
							description,
							assignment_name,
							assignment__reference
						WHERE 
							date > '${startOfMonth}' AND 
							date <= '${endOfMonth}'`;

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				earnings.getByFreelancer(
					providerRefernceId,
					{
						tq: select
					},
					(err, data) => (err ? reject(err) : resolve(data))
				);
			});
		});
	}

	/*
	 * Get earning reports for client
	 */
	private async _getEarningReportsForClient(
		config: IUpworkApiConfig,
		providerId
	): Promise<any> {
		const api = new UpworkApi(config);
		const earnings = new Earnings(api);

		const buyerCompanyReference = '4882863';

		const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
		const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

		const select = `SELECT 
							amount
						WHERE 
							date > '${startOfMonth}' AND 
							date <= '${endOfMonth}' AND
							provider__id = '${providerId}'`;

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				earnings.getByBuyersCompany(
					buyerCompanyReference,
					{
						tq: select
					},
					(err, data) => (err ? reject(err) : resolve(data))
				);
			});
		});
	}

	/*
	 * Get financial reports for freelancer account
	 */
	private async _getFinancialReportsForAccount(
		config: IUpworkApiConfig,
		providerRefernceId
	): Promise<any> {
		const api = new UpworkApi(config);
		const financeReports = new Accounts(api);

		const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
		const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

		const select = `SELECT 
							amount
						WHERE 
							date > '${startOfMonth}' AND 
							date <= '${endOfMonth}'`;

		return new Promise((resolve, reject) => {
			api.setAccessToken(config.accessToken, config.accessSecret, () => {
				financeReports.getSpecific(
					providerRefernceId,
					{
						tq: select
					},
					(err, data) => (err ? reject(err) : resolve(data))
				);
			});
		});
	}
}
