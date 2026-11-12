import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { CHAT_LINK_PREVIEW_FETCH_JOB, CHAT_LINK_PREVIEW_QUEUE, CHAT_LINK_PREVIEW_WORKER_CONCURRENCY } from './chat-link-preview.constants';
import { ChatLinkPreviewService, IChatLinkPreviewFetchJob } from './chat-link-preview.service';

/**
 * Takes the link preview fetches off the `chat-link-preview` queue: fetches the page through the egress guard and
 * stores the preview (or "unavailable") for the tenant. A page that could not be fetched is a stored answer, not a
 * failed job; only a job the cache could not be written for fails (and is not retried: the next ask queues it again).
 */
@Injectable()
@QueueWorker(CHAT_LINK_PREVIEW_QUEUE, { concurrency: CHAT_LINK_PREVIEW_WORKER_CONCURRENCY })
export class ChatLinkPreviewWorker extends QueueWorkerHost {
	private readonly logger = new Logger(ChatLinkPreviewWorker.name);

	constructor(private readonly previews: ChatLinkPreviewService) {
		super();
	}

	@QueueJobHandler(CHAT_LINK_PREVIEW_FETCH_JOB)
	async handleFetch(job: Job<IChatLinkPreviewFetchJob>): Promise<void> {
		const { tenantId, url } = job.data ?? ({} as IChatLinkPreviewFetchJob);
		if (!tenantId || !url) return;
		try {
			await this.previews.refresh(tenantId, url);
		} catch (error) {
			this.logger.error(`A link preview could not be stored: ${(error as Error)?.message}`);
			throw error;
		}
	}
}
