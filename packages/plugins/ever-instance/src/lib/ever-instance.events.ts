import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/** The operator switched the anonymous statistics on or off in Settings. */
export interface EverInstanceStatsToggleEvent {
	type: 'ever.instance.stats_toggle';
	actorId: string | null;
	from: boolean;
	to: boolean;
	at: number;
}

/** The operator reset the identity of this installation (new statistics id and key). */
export interface EverInstanceResetEvent {
	type: 'ever.instance.reset';
	actorId: string | null;
	resetCount: number;
	at: number;
}

export type EverInstanceEvent = EverInstanceStatsToggleEvent | EverInstanceResetEvent;

/**
 * In-process events of the instance identity. Other modules (an audit trail, for example) subscribe
 * to `events$`; nothing is sent anywhere. Events carry no secret, no address and no key material.
 */
@Injectable()
export class EverInstanceEvents {
	private readonly subject = new Subject<EverInstanceEvent>();

	/** Every event, as it happens. */
	readonly events$: Observable<EverInstanceEvent> = this.subject.asObservable();

	emit(event: EverInstanceEvent): void {
		this.subject.next(event);
	}
}
