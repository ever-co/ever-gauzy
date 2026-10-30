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
 * at once after a new link report), it asks for the sign-in client when nothing was asked for yet,
 * reads it while it is being made, queues the links that existed before it was ready, sends the link
 * reports that are due, takes up a person's requests whose handling stopped, and sends again the
 * answers that could not be sent. All of it is kept in the database, so a restart loses nothing.
 * Before a connection exists nothing is scheduled.
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
			['the sign-in client', async () => (await this.everIdLogin.ensureRequested()) || (await this.everIdLogin.pollDue())],
			['the existing links', () => this.backfill()],
			['the link reports', () => this.reporter.sendDue()],
			["a person's requests", () => this.requests.resumeDue()],
			['the answers', () => this.requests.sendDue()]
		] as const) {
			try {
				await work();
			} catch (error) {
				this.logger.warn(`Sign in with Ever ID: ${what} could not be handled now (${errorCode(error)}).`);
			}
		}
	}

	/**
	 * Once the client is ready: the existing links of each linked tenant (also one linked later) are
	 * queued, then the tenant is marked done; a pass that could not run marks nothing (retried).
	 */
	private async backfill(): Promise<void> {
		const linked = (await this.store.liveLinks()).filter((link) => link.status === 'linked').map((link) => link.tenantId);
		const due = await this.everIdLogin.backfillDue(linked);
		if (due.length && (await this.reporter.backfill(due)) !== null) {
			await this.everIdLogin.markBackfilled(due);
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
