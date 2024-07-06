import { Injectable, OnModuleInit, OnModuleDestroy, Logger, HttpStatus, HttpException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Subject } from 'rxjs';
import { catchError, filter, takeUntil, tap } from 'rxjs/operators';
import { IntegrationEnum } from '@gauzy/contracts';
import { EventBus, IntegrationDeleteEvent, RequestContext, TaskEvent } from '@gauzy/core';
import { GithubInstallationDeleteCommand, GithubTaskUpdateOrCreateCommand } from './commands';

@Injectable()
export class GithubEventSubscriber implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('GithubEventSubscriber');
	private readonly onDestroy$: Subject<void> = new Subject<void>();

	constructor(private readonly _eventBus: EventBus, private readonly _commandBus: CommandBus) {}

	/**
	 * Initializes the module and sets up a subscription to listen for IntegrationDeleteEvent events.
	 * The subscription filters the events to only process those related to GitHub integrations.
	 * When an event is received, a GithubInstallationDeleteCommand is executed.
	 */
	async onModuleInit() {
		this.setupIntegrationDeleteEvent();
		this.setupTaskEvent();
	}

	/**
	 * Sets up subscription to handle IntegrationDeleteEvent events.
	 * Executes GithubInstallationDeleteCommand for GitHub integrations.
	 */
	private setupIntegrationDeleteEvent() {
		this._eventBus
			.ofType(IntegrationDeleteEvent)
			.pipe(
				filter((event: IntegrationDeleteEvent) => !!event.integration),
				filter(
					(event: IntegrationDeleteEvent) => event.integration.integration.provider === IntegrationEnum.GITHUB
				),
				tap(async (event: IntegrationDeleteEvent) => {
					const command = new GithubInstallationDeleteCommand(event.integration);
					await this._commandBus.execute(command);
				}),
				catchError((error) => {
					// Handle errors and return an appropriate error response
					console.error(`Error processing IntegrationDeleteEvent: ${error.message}`, error);

					// Throw an HttpException to propagate the error
					throw new HttpException(
						`Error processing IntegrationDeleteEvent: ${error.message}`,
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
							case 'created':
							case 'updated':
								// Only execute command if projectId exists
								if (projectId) {
									await this._commandBus.execute(
										new GithubTaskUpdateOrCreateCommand(event.entity, {
											tenantId,
											organizationId,
											projectId
										})
									);
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
