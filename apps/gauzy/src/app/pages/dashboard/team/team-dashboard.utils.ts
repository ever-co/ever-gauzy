import { IEmployee, ITimeSlot } from '@gauzy/contracts';
import { NbPopoverDirective, NbPosition } from '@nebular/theme';
import { AVATAR_DEFAULT_SVG } from '@gauzy/ui-core/common';

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
	notWorked: number;
	tracking: number;
	online: number;
	duration: number;
	activity: number;
	/** Projects with time on the selected day. */
	projects: number;
	/** The team's projects with the day's time on each, plus any worked on but not linked. */
	projectList: IProjectWorked[];
	managers: string[];
}

/** One project of a team, with the time it got on the selected day — a "Projects worked" list line. */
export interface IProjectWorked {
	id: string;
	name: string;
	imageUrl: string | null;
	initials: string;
	duration: number;
	/** People who logged time on it; a person counts once, whichever of their teams they logged under. */
	members: number;
	/** Bar length against the longest project of the list, 0..100. */
	width: number;
	/** Linked to the team; `false` for a project members tracked time on without it being linked. */
	isLinked: boolean;
}

/** One task a member worked on during the selected day. */
export interface ITaskRow {
	key: string;
	title: string | null;
	projectName: string | null;
	duration: number;
	/** Estimate in seconds; `0` when the task has none. */
	estimate: number;
	/** Time spent against the estimate, 0..100. */
	estimateShare: number;
	isOverEstimate: boolean;
}

/** One member of a team's members table. */
export interface IMemberRow {
	id: string;
	employeeId: string;
	name: string;
	caption: string | null;
	/** The member's photo, or the default avatar when they have none. */
	avatarUrl: string;
	presence: Presence;
	isManager: boolean;
	isWorking: boolean;
	/** Longest first. */
	tasks: ITaskRow[];
	duration: number;
	activity: number;
	/** The organization's working day, in seconds. */
	workPeriod: number;
	/** Time worked against the working day, 0..100. */
	workdayShare: number;
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

/**
 * A member's picture: their photo, or the app's default avatar when they have none.
 * A photo that fails to load falls back to the same default through `ImgDirective`.
 */
export function avatarOf(url: string | undefined | null): string {
	return url || AVATAR_DEFAULT_SVG;
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

/**
 * Activity of a set of time slots: active seconds over tracked seconds, as a percentage — the
 * API's `calculateAverageActivity`, so it is weighted by time instead of averaging percentages.
 * A slot linked to several logs is counted once. `null` when there are no slots to measure.
 */
export function activityOf(slots: Pick<ITimeSlot, 'id' | 'overall' | 'duration'>[]): number | null {
	const unique = [...new Map(slots.filter(Boolean).map((slot) => [slot.id, slot])).values()];
	const duration = unique.reduce((total, slot) => total + (Number(slot.duration) || 0), 0);
	if (!duration) {
		return null;
	}
	const overall = unique.reduce((total, slot) => total + (Number(slot.overall) || 0), 0);
	return Math.round(((overall * 100) / duration) * 100) / 100;
}

/** Percentage of `value` within `total`, clamped to 0..100. */
export function toPercentage(value: number, total: number): number {
	if (!total || !Number.isFinite(total) || !Number.isFinite(value)) {
		return 0;
	}
	return Math.min(Math.max((value / total) * 100, 0), 100);
}

/** What a "Projects worked" popover is given: the list, and how big it may grow. */
export interface IProjectsPopoverContext {
	projects: IProjectWorked[];
	maxHeight: number;
	maxWidth: number;
}

/** The list's own caps, and the least height it shrinks to on a short screen (it scrolls inside either way). */
const PROJECTS_LIST_MAX_HEIGHT = 352;
const PROJECTS_LIST_MIN_HEIGHT = 160;
const PROJECTS_LIST_MAX_WIDTH = 320;
/** Nebular's 15px popover offset, plus a little room from the screen's edge. */
const POPOVER_GAP = 24;
/** Room kept between the list and the screen's left edge. */
const POPOVER_EDGE = 8;

/**
 * Fits a tile's "Projects worked" popover to the screen just before it opens: below the
 * button when the list fits there — or when below is the larger side — otherwise above,
 * with the list capped to the room on that side. Tiles wrap onto more rows on narrow
 * screens, so the button can sit anywhere on the screen. The list opens leftwards from the
 * button's right edge, so its width is capped to the room between that edge and the
 * screen's left edge — on a screen narrower than the list, it narrows instead of spilling.
 *
 * Nebular's own adjustments do not fit here: `vertical` only knows centred top and bottom
 * (it drops the aligned position), the clockwise ones move the list beside the button —
 * hence the popover's `noop`, with the side chosen here.
 *
 * Bound to the button's own `(click)`, which runs before Nebular's click trigger (that one
 * listens on the document) opens the popover. A click that closes it changes nothing.
 * The `-start` positions, in Nebular's naming, line the popover's END edge up with the
 * button's, so it opens into the page from the tile's right-hand corner.
 */
export function fitProjectsPopover(popover: NbPopoverDirective, trigger: EventTarget | null, projects: IProjectWorked[]): void {
	if (popover.isShown || !(trigger instanceof HTMLElement)) {
		return;
	}
	const rect = trigger.getBoundingClientRect();
	const below = window.innerHeight - rect.bottom - POPOVER_GAP;
	const above = rect.top - POPOVER_GAP;
	const placeBelow = below >= PROJECTS_LIST_MAX_HEIGHT || below >= above;
	const room = placeBelow ? below : above;
	popover.position = placeBelow ? NbPosition.BOTTOM_START : NbPosition.TOP_START;
	popover.context = {
		projects,
		maxHeight: Math.max(Math.min(room, PROJECTS_LIST_MAX_HEIGHT), PROJECTS_LIST_MIN_HEIGHT),
		maxWidth: Math.max(Math.min(rect.right - POPOVER_EDGE, PROJECTS_LIST_MAX_WIDTH), 0)
	} as IProjectsPopoverContext;
	popover.rebuild();
}
