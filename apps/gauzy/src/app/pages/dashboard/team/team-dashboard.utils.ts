import { IEmployee } from '@gauzy/contracts';

/** Live presence of a member, as the team page shows it. */
export type Presence = 'tracking' | 'online' | 'away' | 'offline';

/** One team of the "All teams" table. */
export interface ITeamRow {
	id: string;
	name: string;
	initials: string;
	color: string | null;
	logoUrl: string | null;
	isPublic: boolean;
	prefix: string | null;
	total: number;
	worked: number;
	tracking: number;
	online: number;
	duration: number;
	activity: number;
	projects: number;
	/** Share of the members who worked today, 0..100. */
	share: number;
	managers: string[];
}

/** One member of a team's members table. */
export interface IMemberRow {
	id: string;
	employeeId: string;
	name: string;
	caption: string | null;
	avatarUrl: string | null;
	initials: string;
	presence: Presence;
	isManager: boolean;
	isWorking: boolean;
	taskTitle: string | null;
	projectName: string | null;
	moreTasks: number;
	duration: number;
	activity: number;
}

/** One line of the "Top members today" ranking. */
export interface IRankedMember {
	id: string;
	employeeId: string;
	name: string;
	meta: string;
	duration: number;
	/** Bar length against the top line, 0..100. */
	width: number;
}

/** Placeholder picture assigned to users who never uploaded one. */
const DEFAULT_AVATAR_PATTERN = /avatar-default\.svg/i;

/**
 * Live presence of a member: a running timer in the selected day's logs wins,
 * then the employee's own flags, read the same way as the team page.
 */
export function presenceOf(employee: IEmployee, isRunningTimer = false): Presence {
	if (isRunningTimer || employee?.isTrackingTime) return 'tracking';
	if (employee?.isOnline && employee?.isAway) return 'away';
	if (employee?.isOnline) return 'online';
	return 'offline';
}

/** A real profile picture, or `null` for none and for the generic silhouette. */
export function avatarOf(url: string | undefined | null): string | null {
	return url && !DEFAULT_AVATAR_PATTERN.test(url) ? url : null;
}

/** Up to two initials of a name. */
export function initialsOf(name: string): string {
	return (name || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0].toUpperCase())
		.join('');
}

/** `7h 05m`, as the team page writes durations. */
export function formatDuration(seconds: number): string {
	const total = Math.max(0, Math.round(Number(seconds) || 0));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/** `48%`. */
export function formatPercent(value: number | undefined): string {
	return `${Math.round(Number(value) || 0)}%`;
}

/** Colour band of an activity percentage, as the team page's members table uses. */
export function activityTone(value: number): 'high' | 'mid' | 'low' {
	if (value >= 50) return 'high';
	if (value >= 20) return 'mid';
	return 'low';
}

/** Percentage of `value` within `total`, clamped to 0..100. */
export function toPercentage(value: number, total: number): number {
	if (!total || !Number.isFinite(total) || !Number.isFinite(value)) {
		return 0;
	}
	return Math.min(Math.max((value / total) * 100, 0), 100);
}
