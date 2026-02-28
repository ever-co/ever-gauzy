import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_JOB_HANDLER_METADATA } from '../constants/scheduler.constants';

type QueueJobHandler = (job: Job, token?: string) => Promise<unknown> | unknown;

export abstract class QueueWorkerHost extends WorkerHost {
	private handlerMap?: Map<string, QueueJobHandler>;

	async process(job: Job, token?: string): Promise<unknown> {
		const handler = this.getHandlers().get(job.name);

		if (!handler) {
			const available = Array.from(this.getHandlers().keys());
			throw new Error(
				`No handler found for queue job "${job.name}" in ${this.constructor.name}. Available handlers: ${available.join(', ')}`
			);
		}

		return handler(job, token);
	}

	private getHandlers(): Map<string, QueueJobHandler> {
		if (this.handlerMap) {
			return this.handlerMap;
		}

		const handlers = new Map<string, QueueJobHandler>();
		const prototype = Object.getPrototypeOf(this) as Record<string, unknown>;
		const methodNames = Object.getOwnPropertyNames(prototype);

		for (const methodName of methodNames) {
			if (methodName === 'constructor') {
				continue;
			}

			const methodRef = prototype[methodName];
			if (typeof methodRef !== 'function') {
				continue;
			}

			const handlerName = Reflect.getMetadata(QUEUE_JOB_HANDLER_METADATA, methodRef) as string | undefined;
			if (!handlerName) {
				continue;
			}

			if (handlers.has(handlerName)) {
				throw new Error(`Duplicate queue job handler "${handlerName}" in ${this.constructor.name}.`);
			}

			const target = this as unknown as Record<string, QueueJobHandler>;
			handlers.set(handlerName, (job: Job, token?: string) => target[methodName](job, token));
		}

		this.handlerMap = handlers;
		return handlers;
	}
}
