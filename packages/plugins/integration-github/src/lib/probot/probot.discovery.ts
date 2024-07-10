import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
	Inject,
	Injectable,
	Logger,
	OnApplicationBootstrap,
	OnApplicationShutdown,
	OnModuleInit
} from '@nestjs/common';
import { Probot } from 'probot';
import SmeeClient from 'smee-client';
import { isEmpty } from 'underscore';
import * as chalk from 'chalk';
import { v4 } from 'uuid';
import { ModuleProviders, ProbotConfig } from './probot.types';
import { createProbot, createSmee } from './probot.helpers';
import { HookMetadataAccessor } from './hook-metadata.accessor';

@Injectable()
export class ProbotDiscovery implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger('ProbotDiscovery');
	private readonly hooks: Map<string, any>;
	private readonly probot: Probot;
	private smee: SmeeClient;

	constructor(
		private readonly discoveryService: DiscoveryService,
		private readonly metadataAccessor: HookMetadataAccessor,
		private readonly metadataScanner: MetadataScanner,
		@Inject(ModuleProviders.ProbotConfig)
		private readonly config: ProbotConfig
	) {
		this.hooks = new Map<string, any>();
		/** */
		try {
			if (this.config.appId && this.config.privateKey) {
				this.probot = createProbot(this.config);
				console.log(chalk.green(`Probot App successfully initialized.`));
			} else {
				console.error(chalk.red(`Probot App initialization failed: Missing appId or privateKey.`));
			}
		} catch (error) {
			console.error(chalk.red(`Probot App initialization failed: ${error.message}`));
		}
	}

	/**
	 * Called automatically when the module has been initialized.
	 * It discovers and initializes instance wrappers used within the module.
	 */
	public async onModuleInit() {
		this.discoverInstanceWrappers();
	}

	/**
	 * Implementation for onApplicationBootstrap
	 * This method is called when the application is fully initialized.
	 * You can perform setup tasks here.
	 */
	onApplicationBootstrap(): any {
		// Check if webhookProxy is configured
		if (!isEmpty(this.config.webhookProxy)) {
			// Create and start a SmeeClient if webhookProxy is configured
			this.smee = createSmee(this.config);
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
		return this.hooks.set(v4(), {
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
	 * Receive and process a GitHub webhook request.
	 * @param request The incoming webhook request.
	 * @returns A promise that resolves when the webhook is processed.
	 */
	public receiveHook(request: any) {
		if (!this.probot) {
			return;
		}

		// Extract relevant information from the request
		const id = request.headers['x-github-delivery'] as string;
		const event = request.headers['x-github-event'];
		const body = request.body;

		// Call the probot's receive method with extracted information
		return this.probot.receive({ id, name: event, payload: body });
	}
}
