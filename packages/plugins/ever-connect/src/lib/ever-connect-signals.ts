import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

/**
 * In-process signals between the parts of the Ever Platform connection: the connection became
 * usable (start the heartbeat and the event feed), it stopped (stop them), or Ever Platform said the
 * installation's credential was revoked (`401 credential_revoked`, wherever it was seen), or a
 * heartbeat should go out soon.
 */
@Injectable()
export class EverConnectSignals {
	readonly connected$ = new Subject<void>();
	readonly stopped$ = new Subject<void>();
	readonly revoked$ = new Subject<void>();
	/** Send a heartbeat soon (the operator changed the deny list). */
	readonly heartbeat$ = new Subject<void>();
}
