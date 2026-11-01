import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LEASE_MS } from './ever-connect.constants';
import { EverConnectStore } from './ever-connect.store';

/**
 * This API process's hold on the connection's lease: one process of several on one database runs
 * the heartbeat, the event feed and Sign in with Ever ID's background work (the sign-in client, the
 * link reports, the answers to a person's requests).
 */
@Injectable()
export class EverConnectLease {
	readonly holder = randomUUID();

	constructor(private readonly store: EverConnectStore) {}

	/** Takes (or renews) the lease; whether this process holds it. */
	take(): Promise<boolean> {
		return this.store.takeLease(this.holder, LEASE_MS);
	}
}
