import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isSchedulerQueueRootEnabled, SchedulerModule } from '@gauzy/scheduler';
import { ChatLinkPreview } from '../entities/chat-link-preview.entity';
import { isChatLinkPreviewImagesEnabled, isChatLinkPreviewsEnabled } from './chat-link-preview-enabled';
import { ChatLinkPreviewImageService } from './chat-link-preview-image.service';
import { CHAT_LINK_PREVIEW_QUEUE } from './chat-link-preview.constants';
import { CHAT_LINK_PREVIEW_OPTIONS, ChatLinkPreviewService, IChatLinkPreviewOptions } from './chat-link-preview.service';
import { ChatLinkPreviewWorker } from './chat-link-preview.worker';

/**
 * Whether previews are on, and whether their fetches travel on a queue. Read once, when the plugin is loaded (the
 * API's plugin list is built after the environment is read, as `isChatEnabled` is). A queue needs a BullMQ root in the
 * process (`isSchedulerQueueRootEnabled`: Redis on); without one, registering the queue's worker would fail the boot
 * (`Worker requires a connection`), so the fetches run inline instead.
 */
export const CHAT_LINK_PREVIEWS_ENABLED = isChatLinkPreviewsEnabled(process.env, (message) => console.warn(message));
export const CHAT_LINK_PREVIEWS_QUEUED = CHAT_LINK_PREVIEWS_ENABLED && isSchedulerQueueRootEnabled();
/** The previews' pictures, served by the platform: off unless `GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED=true` too. */
export const CHAT_LINK_PREVIEW_IMAGES_ENABLED = isChatLinkPreviewImagesEnabled(process.env, (message) => console.warn(message));

const OPTIONS: IChatLinkPreviewOptions = {
	enabled: CHAT_LINK_PREVIEWS_ENABLED,
	queued: CHAT_LINK_PREVIEWS_QUEUED,
	images: CHAT_LINK_PREVIEW_IMAGES_ENABLED
};

/** The preview cache, its service and the pictures' (the routes are the chat module's, behind its guards). */
@Module({
	imports: [TypeOrmModule.forFeature([ChatLinkPreview]), MikroOrmModule.forFeature([ChatLinkPreview])],
	providers: [{ provide: CHAT_LINK_PREVIEW_OPTIONS, useValue: OPTIONS }, ChatLinkPreviewService, ChatLinkPreviewImageService],
	exports: [ChatLinkPreviewService, ChatLinkPreviewImageService]
})
export class ChatLinkPreviewModule {}

/**
 * The `chat-link-preview` queue and its worker, imported only where previews are on and a queue root exists. A job
 * provider lives in the scheduler's injector, so the service it calls travels with the registration (`imports`). The
 * worker runs in the API processes (the chat plugin is not hosted by `apps/worker`), off the request path, and the job
 * id keeps one fetch per tenant and link across every replica.
 */
@Module({
	imports: [
		ChatLinkPreviewModule,
		SchedulerModule.forFeature({
			queues: [CHAT_LINK_PREVIEW_QUEUE],
			jobProviders: [ChatLinkPreviewWorker],
			imports: [ChatLinkPreviewModule]
		})
	]
})
export class ChatLinkPreviewQueueModule {}
