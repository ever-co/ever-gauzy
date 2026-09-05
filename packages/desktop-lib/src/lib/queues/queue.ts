import EmbeddedQueue from 'embedded-queue';
import { Knex } from 'knex';
import {
	ActivityWatchEventTableList,
	ActivityWatchWindowService,
	ActivityWatchAfkService,
	ActivityWatchChromeService,
	ActivityWatchFirefoxService,
	ActivityWatchEdgeService
} from '../integrations';
import { TimerService, Timer, DesktopOfflineModeHandler } from '../offline';
import { metaData } from '../desktop-wakatime';
import { AuditLogHandler } from '../audit';
import { IOfflineMode } from '../interfaces';

export class QueueHandler {
	private queue: EmbeddedQueue.Queue;
	private static instance: QueueHandler;
	private appName: string;
	private _timerService: TimerService;
	private _offlineMode: IOfflineMode;
	private _auditLogHandler: AuditLogHandler;
	constructor(appName: string) {
		this.appName = appName;
		this._timerService = new TimerService();
		this._offlineMode = DesktopOfflineModeHandler.instance;
		this._auditLogHandler = AuditLogHandler.getInstance();
	}

	public static getInstance(appName: string): QueueHandler {
		if (!QueueHandler.instance) {
			QueueHandler.instance = new QueueHandler(appName);
		}
		return QueueHandler.instance;
	}

	async processWithQueue(type: string, data: any, knex: Knex) {
		const queName = `${type}-${this.appName}`;
		console.log(`processWithQueue Called for ${queName}`);

		if (!this.queue) {
			console.log(`Initializing Queue ${queName}`);

			// Lazy require — deferred from module scope to avoid loading embedded-queue
			// (and its native dependencies) before app.ready.
			const EmbeddedQueue = require('embedded-queue');

			this.queue = await EmbeddedQueue.Queue.createQueue({
				inMemoryOnly: true
			});

			console.log(`Queue initialized ${queName}`);

			this.queue.process(
				queName,
				async (job) => {
					console.log(`Processing Job for ${queName}`);
					await this.ProcessQueueMessage(job, knex);
				},
				// concurrency is 1
				1
			);

			// handle job complete event
			this.queue.on(EmbeddedQueue.Event.Complete, (job, result) => {
				console.log(`Removing Job from Queue ${queName}`);
				job.remove();
			});
		}

		// create job and add to queue
		await this.queue.createJob({
			type: queName,
			data: data
		});

		console.log(`Job Created for ${queName}`);
	}

	private async ProcessQueueMessage(job: any, knex: Knex) {
		await new Promise(async (resolve) => {
			const windowService = new ActivityWatchWindowService();

			const typeJob = job.data.type;

			try {
				switch (typeJob) {
					case ActivityWatchEventTableList.WINDOW:
						{
							console.log('Processing Window Event');
							await windowService.save(job.data.data);
						}
						break;

					case ActivityWatchEventTableList.AFK:
						{
							console.log('Processing AFK Event');
							const afkService = new ActivityWatchAfkService();
							await afkService.save(job.data.data);
						}
						break;

					case ActivityWatchEventTableList.CHROME:
						{
							console.log('Processing Chrome Event');
							const chromeService = new ActivityWatchChromeService();
							await chromeService.save(job.data.data);
						}
						break;

					case ActivityWatchEventTableList.FIREFOX:
						{
							console.log('Processing Firefox Event');
							const firefoxService = new ActivityWatchFirefoxService();
							await firefoxService.save(job.data.data);
						}
						break;

					case ActivityWatchEventTableList.EDGE:
						{
							console.log('Processing Edge Event');
							const edgeService = new ActivityWatchEdgeService();
							await edgeService.save(job.data.data);
						}
						break;

					case 'remove-window-events':
						console.log('Removing Window Events');
						await windowService.clear();
						break;

					case 'remove-wakatime-events':
						console.log('Removing Wakatime Events');
						await metaData.removeActivity(knex, {
							idsWakatime: job.data.data
						});
						break;

					case 'update-duration-timer':
						const pUpdate = {
							id: job.data.data.id,
							duration: job.data.data.duration,
							...(this._offlineMode.enabled && { synced: false })
						};

						await this._timerService.update(new Timer(pUpdate));

						break;

					case 'update-timer-time-slot':
						const pUpdateSlot = {
							id: job.data.data.id,
							timeslotId: job.data.data.timeSlotId,
							timesheetId: job.data.data.timeSheetId
						};

						await this._timerService.update(new Timer(pUpdateSlot));

						break;

					default:
						console.log('Unknown Job Type');
						break;
				}

				resolve(true);
			} catch (error) {
				await this._auditLogHandler.timerAuditError(
					`[ProcessQueueMessage] Failed to process queue job (type: ${job?.data?.type}): ${error?.message ?? error}`
				);
				resolve(false);
			}
		});
	}
}
