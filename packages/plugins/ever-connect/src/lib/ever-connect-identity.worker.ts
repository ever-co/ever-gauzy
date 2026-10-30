import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { IDENTITY_TICK_MS } from './ever-connect.constants';
import { EverConnectLease } from './ever-connect-lease';
import { errorCode } from './ever-connect-platform.service';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore } from './ever-connect.store';
import { EverIdLoginHandler } from './handlers/ever-id-login.handler';
import { PersonRequestsHandler } from './handlers/person-requests.handler';
import { PersonLinkReporter } from './reporters/person-link.reporter';

/**
 * The background work of Sign in with Ever ID and of a person's requests, run by the API process that
 * holds the connection's lease, and only while the installation is connected: every 15 seconds (or
 * at once after a new link report), it reads the sign-in client while it is being made, sends the
 * link reports that are due, and sends again the answers that could not be sent. Before a connection
 * exists nothing is scheduled.
 */
@Injectable()
export class EverConnectIdentityWorker implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverConnect');
	private readonly subscriptions: Subscription[] = [];
	private timer: NodeJS.Timeout | null = null;
	private running = false;
	private ticking: Promise<void> | null = null;

	constructor(
		private readonly store: EverConnectStore,
		private readonly lease: EverConnectLease,
		private readonly signals: EverConnectSignals,
		private readonly everIdLogin: EverIdLoginHandler,
		private readonly reporter: PersonLinkReporter,
		private readonly requests: PersonRequestsHandler
	) {}

	onModuleInit(): void {
		this.reporter.nudge = () => this.schedule(1_000);
		this.subscriptions.push(
			this.signals.connected$.subscribe(() => this.start()),
			this.signals.stopped$.subscribe(() => this.stop())
		);
	}

	onModuleDestroy(): void {
		for (const subscription of this.subscriptions) subscription.unsubscribe();
		this.stop();
	}

	/** Whether a timer of the worker is scheduled. */
	get active(): boolean {
		return this.running || this.timer !== null;
	}

	start(): void {
		if (this.running) return;
		this.running = true;
		this.schedule(IDENTITY_TICK_MS);
	}

	stop(): void {
		this.running = false;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}

	/**
	 * One pass, by the lease holder only: the sign-in client, the link reports, the answers. One
	 * failure never stops the others. Concurrent calls share one pass.
	 */
	tick(): Promise<void> {
		if (!this.ticking) {
			this.ticking = this.pass().finally(() => {
				this.ticking = null;
			});
		}
		return this.ticking;
	}

	private async pass(): Promise<void> {
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !connection.platformInstanceId || !(await this.lease.take())) {
			return;
		}
		for (const [what, work] of [
			['the sign-in client', () => this.everIdLogin.pollDue()],
			['the link reports', () => this.reporter.sendDue()],
			['the answers', () => this.requests.sendDue()]
		] as const) {
			try {
				await work();
			} catch (error) {
				this.logger.warn(`Sign in with Ever ID: ${what} could not be handled now (${errorCode(error)}).`);
			}
		}
	}

	private schedule(delayMs: number): void {
		if (!this.running) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.timer = null;
			this.tick()
				.catch((error) => this.logger.warn(`Sign in with Ever ID could not run now (${errorCode(error)}).`))
				.finally(() => this.schedule(IDENTITY_TICK_MS));
		}, delayMs);
		this.timer.unref?.();
	}
}
