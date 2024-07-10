import { Injectable, OnModuleInit, OnModuleDestroy, Logger, HttpStatus, HttpException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { catchError, filter, takeUntil, tap } from 'rxjs/operators';
import { EventBus } from '../../event-bus/event-bus';
import { BaseEntityEventTypeEnum } from '../../event-bus/base-entity-event';
import { ScreenshotEvent } from '../../event-bus/events/screenshot.event';
import { ScreenshotAnalysisService } from './screenshot-analysis.service';

@Injectable()
export class ScreenshotEventSubscriber implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('ScreenshotEventSubscriber');
	private readonly onDestroy$: Subject<void> = new Subject<void>();

	constructor(
		private readonly _eventBus: EventBus,
		private readonly _screenshotAnalysisService: ScreenshotAnalysisService
	) {}

	/**
	 * Initializes the module and sets up a subscription to listen for IntegrationEvent events.
	 * The subscription filters the events to only process those related to GitHub integrations.
	 * When an event is received, a GithubInstallationDeleteCommand is executed.
	 */
	async onModuleInit() {
		this._eventBus
			.ofType(ScreenshotEvent)
			.pipe(
				filter((event: ScreenshotEvent) => !!event.entity),
				tap(async (event: ScreenshotEvent) => {
					try {
						switch (event.type) {
							case BaseEntityEventTypeEnum.CREATED:
								// Analyze image using Gauzy AI
								await this._screenshotAnalysisService.analyzeAndSaveScreenshot(event);
								break;
							default:
								this.logger.warn(`Unhandled event type: ${event.type}`);
								break;
						}
					} catch (error) {
						this.logger.error('Error while processing screenshot event', error.message);
					}
				}),
				catchError((error) => {
					this.logger.error('Error in event subscription', error.message);

					throw new HttpException(
						`Error in event subscription: ${error.message}`,
						HttpStatus.INTERNAL_SERVER_ERROR
					);
				}),
				takeUntil(this.onDestroy$)
			)
			.subscribe();
	}

	/**
	 * This method is called when the module is destroyed.
	 * It emits a value and completes the onDestroy$ subject to ensure
	 * all subscriptions are properly unsubscribed, preventing memory leaks.
	 */
	async onModuleDestroy() {
		this.onDestroy$.next();
		this.onDestroy$.complete();
	}
}
