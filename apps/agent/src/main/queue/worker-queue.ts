import { app } from "electron";
import { DesktopQueue, IQueueUpdatePayload } from "@gauzy/desktop-activity";
import * as path from 'path';
import { ITimeslotQueuePayload, ITimerCallbackPayload, IScreenshotQueuePayload } from "@gauzy/desktop-activity";
import { QueueAudit } from "./audit-queue";
import { ApiService } from '../api';
import { SyncManager } from './sync-manager';


export interface IQueueHandler {
	timerQueueHandler: (job: ITimerCallbackPayload, cb: (err?: any) => void) => void;
	timeSlotQueueHandler: (job: ITimeslotQueuePayload, cb: (err?: any) => void) => void;
	screenshotQueueHandler: (job: IScreenshotQueuePayload, cb: (err?: any) => void) => void;
}

export class WorkerQueue {
	static instance: WorkerQueue;
	public desktopQueue: DesktopQueue;
	private queueAudit: QueueAudit;
	private apiService: ApiService;
	private syncManager: SyncManager;

	constructor() {
		this.apiService = ApiService.getInstance();
		this.desktopQueue = new DesktopQueue(path.resolve(app?.getPath('userData') || __dirname));
		this.queueAudit = QueueAudit.getInstance();
		this.setQueueUpdateHandle();
		this.setServerCheckHandle();
		this.desktopQueue.setWorkerHandler(this.workerHandler.bind(this))
		this.syncManager = new SyncManager();
	}

	static getInstance(): WorkerQueue {
		if (!WorkerQueue.instance) {
			WorkerQueue.instance = new WorkerQueue();
		}
		return WorkerQueue.instance;
	}

	public initQueue(handler: IQueueHandler) {
		this.desktopQueue.initTimerQueue(handler.timerQueueHandler);
		this.desktopQueue.initTimeslotQueue(handler.timeSlotQueueHandler);
		this.desktopQueue.initScreenshotQueue(handler.screenshotQueueHandler);
	}

	private enqueueTimerRetry(payload: ITimerCallbackPayload) {
		this.desktopQueue.enqueueTimer(payload);
	}

	private enqueueTimeslotRetry(payload: ITimeslotQueuePayload) {
		this.desktopQueue.enqueueTimeSlot(payload);
	}

	private enqueueScreenshotRetry(payload: IScreenshotQueuePayload) {
		this.desktopQueue.enqueueScreenshot(payload);
	}

	public imidietlyCheckUnSync() {
		this.syncManager.setQueueCallback(
			this.enqueueTimerRetry.bind(this),
			this.enqueueTimeslotRetry.bind(this),
			this.enqueueScreenshotRetry.bind(this)
		);
		this.syncManager.imidietlyCheck();
	}

	private queueAuditCallback(payload: IQueueUpdatePayload) {
		switch (payload.type) {
			case 'queued':
				return this.queueAudit.queued(
					payload.id,
					payload.queue,
					payload.data,
					0
				);
			case 'running':
				return this.queueAudit.running(payload.id, payload.data);
			case 'succeeded':
				return this.queueAudit.succeeded(payload.id);
			case "failed":
				return this.queueAudit.failed(payload.id, payload.err);
			default:
				break;
		}
	}

	private workerHandler() {
		return this.syncManager.tickHandler();
	}

	private setQueueUpdateHandle() {
		this.desktopQueue.setUpdateQueueCallback(this.queueAuditCallback.bind(this));
	}

	private serverCheck(): Promise<boolean> {
		return this.apiService.serverCheck();
	}

	private setServerCheckHandle() {
		this.desktopQueue.setServiceCheckCallback(this.serverCheck.bind(this));
	}
}
