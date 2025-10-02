import { app } from "electron";
import { DesktopQueue, IQueueUpdatePayload } from "@gauzy/desktop-activity";
import * as path from 'path';
import { ITimeslotQueuePayload, ITimerCallbackPayload, IScreenshotQueuePayload } from "@gauzy/desktop-activity";
import { QueueAudit } from "./audit-queue";


export interface IQueueHandler {
	timerQueueHandler: (job: ITimerCallbackPayload, cb: (err?: any) => void) => void;
	timeSlotQueueHandler: (job: ITimeslotQueuePayload, cb: (err?: any) => void) => void;
	screenshotQueueHandler: (job: IScreenshotQueuePayload, cb: (err?: any) => void) => void;
}


export class WorkerQueue {
	static instance: WorkerQueue;
	public desktopQueue: DesktopQueue;
	private queueAudit: QueueAudit;

	constructor() {
		this.desktopQueue = new DesktopQueue(path.resolve(app?.getPath('userData') || __dirname));
		this.queueAudit = QueueAudit.getInstance();
		this.setQueueUpdateHandle();
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

	private setQueueUpdateHandle() {
		this.desktopQueue.setUpdateQueueCallback(this.queueAuditCallback.bind(this));
	}
}
