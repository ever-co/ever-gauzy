import { Injectable, OnModuleInit, OnModuleDestroy, Logger, HttpStatus, HttpException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Subject } from 'rxjs';
import { catchError, filter, takeUntil, tap } from 'rxjs/operators';
import { IntegrationEnum } from '@gauzy/contracts';
import { BaseEntityEventTypeEnum, EventBus, IntegrationEvent, RequestContext, TaskEvent } from '@gauzy/core';
import { GithubInstallationDeleteCommand, GithubTaskUpdateOrCreateCommand } from './commands';

@Injectable()
export class GithubEventSubscriber implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('GithubEventSubscriber');
	private readonly onDestroy$: Subject<void> = new Subject<void>();

	constructor(private readonly _eventBus: EventBus, private readonly _commandBus: CommandBus) {}

	/**
	 * Initializes the module and sets up a subscription to listen for IntegrationEvent events.
	 * The subscription filters the events to only process those related to GitHub integrations.
	 * When an event is received, a GithubInstallationDeleteCommand is executed.
	 */
	async onModuleInit() {
		this.setupIntegrationEvent();
		this.setupTaskEvent();
	}

	/**
	 * Sets up a subscription to listen for IntegrationEvent events.
	 * Depending on the event type, it will execute the appropriate command.
	 */
	private setupIntegrationEvent() {
		this._eventBus
			.ofType(IntegrationEvent)
			.pipe(
				filter((event: IntegrationEvent) => !!event.entity),
				filter((event: IntegrationEvent) => event.entity.integration.provider === IntegrationEnum.GITHUB),
				tap(async (event: IntegrationEvent) => {
					switch (event.type) {
						case BaseEntityEventTypeEnum.DELETED:
							const command = new GithubInstallationDeleteCommand(event.entity);
							await this._commandBus.execute(command);
							break;
						default:
							this.logger.warn(`Unhandled event type: ${event.type}`);
							break;
					}
				}),
				catchError((error) => {
					// Handle errors and return an appropriate error response
					this.logger.error(`Error processing IntegrationEvent: ${error.message}`, error.message);

					// Throw an HttpException to propagate the error
					throw new HttpException(
						`Error processing IntegrationEvent: ${error.message}`,
						HttpStatus.INTERNAL_SERVER_ERROR
					);
				}),
				takeUntil(this.onDestroy$)
			)
			.subscribe();
	}

	/**
	 * Sets up a subscription to listen for TaskEvent events.
	 * Depending on the event type, it will execute the appropriate command.
	 */
	private setupTaskEvent() {
		this._eventBus
			.ofType(TaskEvent)
			.pipe(
				tap(async (event: TaskEvent) => {
					try {
						const { organizationId, projectId } = event.input;
						const tenantId = RequestContext.currentTenantId() || event.input.tenantId;

						switch (event.type) {
							case BaseEntityEventTypeEnum.CREATED:
							case BaseEntityEventTypeEnum.UPDATED:
								// Only execute command if projectId exists
								if (projectId) {
									const command = new GithubTaskUpdateOrCreateCommand(event.entity, {
										tenantId,
										organizationId,
										projectId
									});
									await this._commandBus.execute(command);
								}
								break;
							default:
								this.logger.warn(`Unhandled event type: ${event.type}`);
								break;
						}
					} catch (error) {
						this.logger.error('Error while processing task event', error.message);
						throw new HttpException(
							`Error while processing task event: ${error.message}`,
							HttpStatus.INTERNAL_SERVER_ERROR
						);
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
