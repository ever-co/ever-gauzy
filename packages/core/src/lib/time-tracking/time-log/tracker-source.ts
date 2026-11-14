import { TimeLogSourceEnum } from '@gauzy/contracts';

/**
 * The trackers whose time an organization's tracking requirements fill but never refuse. The desktop timer and the
 * agent start their clock before the server answers and resend a refused start or upload on every sync, so a refusal
 * would keep the tracked time on the machine for good. They also send time slots while they run, so the time slots of
 * their runs say when work on them stopped (see `TimerService.stopPreviousRunningTimers`).
 */
const TRACKER_SOURCES: ReadonlyArray<string> = [TimeLogSourceEnum.DESKTOP];

/**
 * Whether a timer start or a time upload comes from a tracker whose time is never refused, or a run from one.
 *
 * @param source The source the client sent, or the run's own.
 */
export function isTrackerSource(source: string | null | undefined): boolean {
	return TRACKER_SOURCES.includes(source);
}

/**
 * The clients that post a time slot on each heartbeat of a run: Ever Teams (every minute) and its mobile app. The time
 * slots of their runs say how long they went, and a run of theirs without one died before its first heartbeat.
 */
const HEARTBEAT_SLOT_SOURCES: ReadonlyArray<string> = [TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE];

/**
 * Whether a run comes from a client that posts a time slot on each heartbeat (Ever Teams, mobile).
 *
 * @param source The run's source.
 */
export function postsHeartbeatSlots(source: string | null | undefined): boolean {
	return HEARTBEAT_SLOT_SOURCES.includes(source);
}
