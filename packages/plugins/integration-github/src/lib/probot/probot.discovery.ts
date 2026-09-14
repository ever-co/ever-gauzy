import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	OnApplicationBootstrap,
	OnApplicationShutdown,
	OnModuleInit
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import SmeeClient from 'smee-client';
import { isEmpty } from 'underscore';
import * as chalk from 'chalk';
import type { Probot } from 'probot';
import { ModuleProviders, ProbotConfig } from './probot.types';
import { createProbot, createSmee } from './probot.helpers';
import { HookMetadataAccessor } from './hook-metadata.accessor';
import { GITHUB_SIGNATURE_HEADER, verifyGithubWebhookSignature } from './webhook-signature';

/**
 * The shape {@link ProbotDiscovery.receiveHook} needs off the incoming Express request.
 *
 * `rawBody` is stashed by the API bootstrap's `captureRawBody` body-parser hook — the HMAC has to be
 * computed over the bytes GitHub signed, which the parsed `body` object no longer is.
 */
export interface IGithubWebhookRequest {
	headers: Record<string, string | string[] | undefined>;
	rawBody?: Buffer;
}

/** First value of a header, or `undefined` when absent/empty/repeated as an array. */
const headerValue = (request: IGithubWebhookRequest, name: string): string | undefined => {
	const value = request?.headers?.[name];
	const single = Array.isArray(value) ? value[0] : value;
	return typeof single === 'string' && single.length > 0 ? single : undefined;
};

@Injectable()
export class ProbotDiscovery implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger('ProbotDiscovery');
	private readonly hooks: Map<string, any>;
	private probot: Probot | null = null; // Probot instance (dynamically imported)
	private smee: SmeeClient;

	constructor(
		private readonly discoveryService: DiscoveryService,
		private readonly metadataAccessor: HookMetadataAccessor,
		private readonly metadataScanner: MetadataScanner,
		@Inject(ModuleProviders.ProbotConfig)
		private readonly config: ProbotConfig
	) {
		this.hooks = new Map<string, any>();
		// Note: Probot initialization moved to onModuleInit to handle async operations
	}

	/**
	 * Called automatically when the module has been initialized.
	 * It discovers and initializes instance wrappers used within the module.
	 */
	public async onModuleInit() {
		// Initialize Probot asynchronously
		try {
			if (this.config.appId && this.config.privateKey) {
				this.probot = await createProbot(this.config);
				console.log(chalk.green(`Probot App successfully initialized.`));
				// Loud, because the receiver now refuses every delivery without it: a GitHub App that
				// is otherwise fully configured would silently stop syncing installations and issues.
				if (!this.config.webhookSecret?.trim()) {
					console.warn(
						chalk.yellow(
							`GAUZY_GITHUB_WEBHOOK_SECRET is not set: GitHub webhook deliveries will be rejected (403). ` +
								`Set it to the webhook secret configured in the GitHub App.`
						)
					);
				}
			} else {
				console.warn(chalk.yellow(`Probot App initialization skipped: Missing appId or privateKey.`));
			}
		} catch (error) {
			console.error(chalk.red(`Probot App initialization failed: ${error.message}`));
		}

		this.discoverInstanceWrappers();
	}

	/**
	 * Implementation for onApplicationBootstrap
	 * This method is called when the application is fully initialized.
	 * You can perform setup tasks here.
	 */
	async onApplicationBootstrap(): Promise<any> {
		// Check if webhookProxy is configured
		if (!isEmpty(this.config.webhookProxy)) {
			// Create and start a SmeeClient if webhookProxy is configured
			this.smee = await createSmee(this.config);
			this.smee.start();
		}

		// Mount the webhook event listeners
		this.mountHooks();
	}

	/**
	 * Implementation for onApplicationShutdown
	 * This method is called when the application is about to shut down.
	 * You can perform cleanup tasks here.
	 * @param signal
	 */
	onApplicationShutdown(signal?: string): any {
		// TODO clear probot event handlers on shutdown
	}

	/**
	 * Initialize and mount event listeners for Probot hooks.
	 */
	mountHooks() {
		if (!this.probot) {
			return;
		}
		this.probot
			.load((app: { on: (eventName: any, callback: (context: any) => Promise<void>) => any }) => {
				// Iterate through registered hooks and add event listeners
				this.hooks.forEach((hook) => {
					app.on(
						hook.eventOrEvents, // The event name or names to listen for
						this.initContext(hook.target) // The callback function for the event
					);
				});
			})
			.then(() => {
				// Log a message when hook event listeners are initialized
				this.logger.log('Hook event listeners initialized');
			})
			.catch(this.logger.error); // Handle any errors that occur during initialization
	}

	/**
	 * Create an asynchronous context wrapper for a function.
	 * @param fn The original function to be wrapped.
	 * @returns An asynchronous function that calls the original function.
	 */
	initContext(fn: (context: any) => any) {
		return async (context: any) => {
			await fn(context); // Call the original function with the provided context.
		};
	}

	/**
	 * Explore and analyze methods of instance wrappers (controllers and providers).
	 */
	discoverInstanceWrappers() {
		// Get all instance wrappers for controllers and providers
		const instanceWrappers: InstanceWrapper[] = [
			...this.discoveryService.getControllers(),
			...this.discoveryService.getProviders()
		];

		// Filter instance wrappers with static dependency trees
		const staticInstanceWrappers = instanceWrappers.filter((wrapper: InstanceWrapper) =>
			wrapper.isDependencyTreeStatic()
		);

		// Iterate through static instance wrappers and explore methods
		staticInstanceWrappers.forEach((wrapper: InstanceWrapper) => {
			const { instance } = wrapper;

			// Skip if instance or its prototype is missing
			if (!instance || !Object.getPrototypeOf(instance)) {
				return;
			}

			// Get the prototype of the instance
			const instancePrototype = Object.getPrototypeOf(instance);

			// Get all method names from the prototype
			const methodNames = this.metadataScanner.getAllMethodNames(instancePrototype);

			// Iterate through method names and lookup hooks
			methodNames.forEach((methodName: string) => {
				this.lookupHooks(instance, methodName);
			});
		});
	}

	/**
	 * Look up and process webhook hooks associated with a method of an instance.
	 * @param instance The instance to examine.
	 * @param key The method name to inspect.
	 * @returns The stored hook information or null if no webhook event definition.
	 */
	lookupHooks(instance: Record<string, () => any>, key: string) {
		// Get the method reference from the instance
		const methodRef = instance[key];
		// Get webhook event metadata for the method
		const hookMetadata = this.metadataAccessor.getWebhookEvents(methodRef);
		// Wrap the method in try-catch blocks if needed
		const hookFn = this.wrapFunctionInTryCatchBlocks(methodRef, instance);

		// If no webhook event definition, skip
		if (isEmpty(hookMetadata)) {
			return null;
		}

		// Generate a unique key and store the hook information
		return this.hooks.set(randomUUID(), {
			target: hookFn,
			eventOrEvents: hookMetadata
		});
	}

	/**
	 * Wrap a method reference in try-catch blocks to handle errors and log them.
	 * @param methodRef The method reference to wrap.
	 * @param instance The instance to which the method belongs.
	 * @returns An asynchronous function that handles errors and logs them.
	 */
	private wrapFunctionInTryCatchBlocks(methodRef: () => any, instance: Record<string, any>) {
		// Return an asynchronous function that wraps the method reference
		return async (...args: unknown[]) => {
			try {
				// Call the method reference with the provided instance and arguments
				await methodRef.call(instance, ...args);
			} catch (error) {
				// Handle and log any errors using the logger
				this.logger.error(error);
			}
		};
	}

	/**
	 * Receive, AUTHENTICATE and process a GitHub webhook request.
	 *
	 * This route is `@Public()` and the handlers behind it deliberately run outside any
	 * `RequestContext` — `installation.deleted` hard-deletes the `IntegrationTenant` row (and its
	 * cascaded settings and integration maps) of whichever tenant owns the installation id in the
	 * body, and `issues.*` creates or overwrites Tasks and Tags in that tenant. The HMAC signature is
	 * therefore the ONLY boundary between the open internet and every tenant's integration state, so
	 * it is verified here before anything is parsed or dispatched, and there is no bypass for local
	 * development (smee forwards GitHub's signature headers unchanged).
	 *
	 * Fails CLOSED: an unconfigured receiver, a missing header, a body the body-parser did not stash
	 * and a bad signature all answer 403 rather than the old unconditional 201.
	 *
	 * @param request The incoming webhook request.
	 * @returns A promise that resolves when the webhook is processed.
	 * @throws ForbiddenException when the delivery cannot be proven to come from GitHub.
	 */
	public async receiveHook(request: IGithubWebhookRequest): Promise<void> {
		const secret = this.config.webhookSecret?.trim();

		// No Probot instance (no appId/privateKey) or no secret means this deployment cannot verify
		// anything. Answering 2xx there is indistinguishable from a working receiver — refuse, so the
		// misconfiguration shows up in the GitHub App's delivery log instead of being silently dropped.
		if (!this.probot || !secret) {
			throw new ForbiddenException('GitHub webhooks are not enabled on this deployment.');
		}

		const id = headerValue(request, 'x-github-delivery');
		const event = headerValue(request, 'x-github-event');
		const signature = headerValue(request, GITHUB_SIGNATURE_HEADER);
		const payload = request.rawBody;

		if (!id || !event || !signature || !payload?.length) {
			throw new ForbiddenException('Missing GitHub webhook signature.');
		}

		if (!verifyGithubWebhookSignature(payload, signature, secret)) {
			this.logger.warn(`Rejected GitHub webhook delivery ${id} (${event}): signature did not verify.`);
			throw new ForbiddenException('Invalid GitHub webhook signature.');
		}

		// Parse only AFTER the bytes are proven authentic, and parse the same bytes that were hashed —
		// `request.body` is a re-parse of them by the body parser and must not be trusted as the thing
		// the signature covered.
		let body: unknown;
		try {
			body = JSON.parse(payload.toString('utf8'));
		} catch {
			// Also the landing place for a GitHub App configured to send `application/x-www-form-urlencoded`
			// (its JSON arrives under a `payload=` field), which this receiver has never supported.
			throw new ForbiddenException('Malformed GitHub webhook payload.');
		}

		// Call the probot's receive method with the verified information
		await this.probot.receive({ id, name: event as any, payload: body as any });
	}
}
