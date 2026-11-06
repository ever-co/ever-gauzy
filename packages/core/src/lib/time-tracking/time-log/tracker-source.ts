import { TimeLogSourceEnum } from '@gauzy/contracts';

/**
 * The trackers whose time an organization's tracking requirements fill but never refuse. The desktop timer and the
 * agent start their clock before the server answers and resend a refused start or upload on every sync, so a refusal
 * would keep the tracked time on the machine for good.
 */
const TRACKER_SOURCES: ReadonlyArray<string> = [TimeLogSourceEnum.DESKTOP];

/**
 * Whether a timer start or a time upload comes from a tracker whose time is never refused.
 *
 * @param source The source the client sent.
 */
export function isTrackerSource(source: string | null | undefined): boolean {
	return TRACKER_SOURCES.includes(source);
}
