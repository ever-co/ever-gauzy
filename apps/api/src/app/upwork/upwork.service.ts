import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import * as UpworkApi from 'upwork-api';
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
	ProjectTypeEnum,
	TimeLogType,
	IntegrationEntity,
} from '@gauzy/models';
import {
	IntegrationTenantCreateCommand,
	IntegrationTenantGetCommand,
} from '../integration-tenant/commands';
import {
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand,
	IntegrationSettingCreateCommand,
} from '../integration-setting/commands';
import { arrayToObject } from '../core';
import { Engagements } from 'upwork-api/lib/routers/hr/engagements.js';
import { Workdiary } from 'upwork-api/lib/routers/workdiary.js';
import { IntegrationMapSyncEntityCommand } from '../integration-map/commands';
import {
	TimesheetGetCommand,
	TimesheetCreateCommand,
	TimeLogCreateCommand,
	TimeSlotCreateCommand,
} from '../timesheet/commands';
import * as moment from 'moment';
import { OrganizationProjectCreateCommand } from '../organization-projects/commands/organization-project.create.command';

@Injectable()
export class UpworkService {
	private _upworkApi: UpworkApi;

	constructor(private commandBus: CommandBus) {}

	private async _consumerHasAccessToken(consumerKey: string) {
		const integrationSetting = await this.commandBus.execute(
			new IntegrationSettingGetCommand({
				where: { settingsValue: consumerKey },
				relations: ['integration'],
			})
		);
		if (!integrationSetting) {
			return false;
		}

		const integrationSettings = await this.commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: { integration: integrationSetting.integration },
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
				...integrationSettingMap,
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
									settingsValue: config.consumerKey,
								},
								{
									settingsName: 'consumerSecret',
									settingsValue: config.consumerSecret,
								},
								{
									settingsName: 'requestToken',
									settingsValue: requestToken,
								},
								{
									settingsName: 'requestTokenSecret',
									settingsValue: requestTokenSecret,
								},
							],
						})
					);
					return resolve({ url, requestToken, requestTokenSecret });
				}
			);
		});
	}

	getAccessToken({
		requestToken,
		verifier,
	}: IAccessTokenDto): Promise<IAccessToken> {
		return new Promise(async (resolve, reject) => {
			const { integration } = await this.commandBus.execute(
				new IntegrationSettingGetCommand({
					where: { settingsValue: requestToken },
					relations: ['integration'],
				})
			);

			const integrationSettings = await this.commandBus.execute(
				new IntegrationSettingGetManyCommand({
					where: { integration },
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
							settingsValue: accessToken,
						})
					);
					await this.commandBus.execute(
						new IntegrationSettingCreateCommand({
							integration,
							settingsName: 'accessTokenSecret',
							settingsValue: accessTokenSecret,
						})
					);

					resolve({
						integrationId: integration.id,
						accessToken,
						accessTokenSecret,
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
				where: { integration },
			})
		);
		const {
			accessToken,
			consumerKey,
			consumerSecret,
			accessTokenSecret: accessSecret,
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
								engagements: { engagement },
							} = data;
							resolve(engagement);
						}
					});
				}
			);
		});
	}

	async syncContracts({
		integrationId,
		organizationId,
		contracts,
	}): Promise<IIntegrationMap[]> {
		return await Promise.all(
			await contracts.map(
				async ({ job__title: name, reference: sourceId }) => {
					const project = await this.commandBus.execute(
						new OrganizationProjectCreateCommand({
							name,
							organizationId,
							public: true,
							type: ProjectTypeEnum.RATE,
							currency: CurrenciesEnum.BGN,
						})
					);

					return await this.commandBus.execute(
						new IntegrationMapSyncEntityCommand({
							gauzyId: project.id,
							integrationId,
							sourceId,
							entity: IntegrationEntity.PROJECT,
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
			offset: 0,
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
				where: { employeeId: timeLog.employeeId },
			})
		);

		if (!timesheet) {
			timesheet = await this.commandBus.execute(
				new TimesheetCreateCommand({
					startedAt: timeLog.startDate,
					employeeId: timeLog.employeeId,
					mouse: timeLog.mouse_events_count,
					keyboard: timeLog.keyboard_events_count,
					duration: timeLog.duration,
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
				timesheetId: timesheet.id,
			})
		);

		await this.commandBus.execute(
			new IntegrationMapSyncEntityCommand({
				gauzyId: gauzyTimeLog.id,
				integrationId: timeLog.integrationId,
				sourceId: timeLog.sourceId,
				entity: IntegrationEntity.TIME_LOG,
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
					duration: 0,
				})
			);

			const integratedSlot = await this.commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: gauzyTimeSlot.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.TIME_SLOT,
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
			syncedContracts.map(async (c) => {
				const wd = await this.getWorkDiary({
					contractId: c.sourceId,
					config,
					forDate,
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
					projectId: c.gauzyId,
					startDate: moment
						.unix(cells[0].cell_time)
						.format('YYYY-MM-DD HH:mm:ss'),
					duration: cells.length * 10 * 60,
					sourceId,
				};

				const timeSlotsDto = {
					timeSlots: cells,
					employeeId,
					integrationId,
					sourceId,
				};

				const integratedTimeLog = await this.syncTimeLog(timeLogDto);
				const integratedTimeSlots = await this.syncTimeSlots(
					timeSlotsDto
				);

				return { integratedTimeLog, integratedTimeSlots };
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
						: TimeLogType.TRACKED,
				};
			},
			{
				keyboard: 0,
				mouse: 0,
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
	}) {
		const syncedContracts = await this.syncContracts({
			contracts,
			integrationId,
			organizationId,
		});
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
					default:
						return;
				}
			})
		);
	}
}
