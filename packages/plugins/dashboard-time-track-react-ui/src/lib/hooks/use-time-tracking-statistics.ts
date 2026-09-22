import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import {
	IActivitiesStatistics,
	ICountsStatistics,
	IGetActivitiesStatistics,
	IGetCountsStatistics,
	IGetManualTimesStatistics,
	IGetMembersStatistics,
	IGetProjectsStatistics,
	IGetTasksStatistics,
	IGetTimeSlotStatistics,
	IManualTimesStatistics,
	IMembersStatistics,
	IProjectsStatistics,
	ITasksStatistics,
	ITimeSlotStatistics
} from '@gauzy/contracts';
import {
	EmployeesService,
	OrganizationProjectsService,
	TimesheetStatisticsService,
	ToastrService
} from '@gauzy/ui-core/core';
import { GalleryService } from '@gauzy/ui-core/shared';
import { useInjector, useTypedEvent } from '@gauzy/ui-react';
import { DashboardRefreshedEvent } from '../dashboard-time-track-react-ui.events';
import { collectGalleryItems, normalizeMemberWeekHours, Windows, withDurationPercentage } from '../utils';
import { type TimeTrackingSelection } from './use-time-tracking-context';

/** Angular `setAutoRefresh`: `timer(0, 60000 * 5)` — five minutes. */
export const AUTO_REFRESH_INTERVAL_MS = 60000 * 5;

/** Angular `payloads$.pipe(debounceTime(200))` + `logs$.pipe(debounceTime(200))`. */
const REFRESH_DEBOUNCE_MS = 200;

/** Per-panel loading flags (Angular `*Loading` booleans). */
export interface StatisticsLoading {
	counts: boolean;
	timeSlots: boolean;
	activities: boolean;
	projects: boolean;
	tasks: boolean;
	manualTimes: boolean;
	members: boolean;
}

export interface UseTimeTrackingStatisticsOptions {
	/** Current selection (payload etc.); `null` until the Angular selectors emitted. */
	selection: TimeTrackingSelection | null;
	/** Auto-refresh toggle (5-minute timer while on). */
	autoRefresh: boolean;
	/** Read at fetch time: skip `getCounts` when every widget is hidden. */
	isAllWidgetsHidden: () => boolean;
	/** Read at fetch time: skip a window's fetch while it is hidden. */
	isWindowHidden: (position: Windows) => boolean;
	/** `CHANGE_SELECTED_EMPLOYEE` — the Members window/fetch is gated on it. */
	canViewMembers: boolean;
	/** True when the signed-in user IS an employee (Angular skips `loadEmployeesCount` then). */
	isEmployeeUser: boolean;
}

export interface TimeTrackingStatistics {
	counts: ICountsStatistics | null;
	timeSlots: ITimeSlotStatistics[];
	activities: IActivitiesStatistics[];
	projects: IProjectsStatistics[];
	tasks: ITasksStatistics[];
	manualTimes: IManualTimesStatistics[];
	members: IMembersStatistics[];
	loading: StatisticsLoading;
	/** `EmployeesService.getCount` — the "Members worked" dot-strip denominator. */
	employeesCount: number | undefined;
	/** `OrganizationProjectsService.getCount` — the "Projects worked" dot-strip denominator. */
	projectsCount: number | undefined;
	/** Manual refresh (Angular `logs$.next(true)`): clears the gallery and refetches everything. */
	refresh: () => Promise<void>;
	/** Refetches the counters only (a widget was re-shown). */
	fetchCounts: () => Promise<void>;
	/** Refetches one window's data (Angular `recover(position)`). */
	recoverWindow: (position: Windows) => Promise<void>;
}

const INITIAL_LOADING: StatisticsLoading = {
	counts: false,
	timeSlots: false,
	activities: false,
	projects: false,
	tasks: false,
	manualTimes: false,
	members: false
};

/**
 * The data layer of the React Time Tracking dashboard — a hook-shaped port of the fetch half of
 * Angular's `TimeTrackingComponent`.
 *
 * Same services (`TimesheetStatisticsService` promise API), same seven requests, same
 * skip-when-hidden gates, `Promise.allSettled`, `ToastrService.error` on failure, the same
 * `durationPercentage` / `weekHours` reshaping, `GalleryService.clearGallery()` on every refresh
 * and on unmount, and the same auto-refresh (5 minutes, restarted whenever the selection
 * changes). Results from a superseded selection are dropped so a slow response cannot
 * overwrite a newer one.
 *
 * @param options See {@link UseTimeTrackingStatisticsOptions}.
 */
export function useTimeTrackingStatistics(options: UseTimeTrackingStatisticsOptions): TimeTrackingStatistics {
	const { selection, autoRefresh, isAllWidgetsHidden, isWindowHidden, canViewMembers, isEmployeeUser } = options;
	const injector = useInjector();
	const statisticsService = useMemo(() => injector.get(TimesheetStatisticsService), [injector]);
	const toastrService = useMemo(() => injector.get(ToastrService), [injector]);
	const galleryService = useMemo(() => injector.get(GalleryService), [injector]);
	// `EmployeesService` is module-provided (SelectorsModule/EmployeeMutationModule hoist it to root in the
	// app shell); tolerate a host that does not provide it instead of throwing at render.
	const employeesService = useMemo(() => injector.get(EmployeesService, null), [injector]);
	const projectsService = useMemo(() => injector.get(OrganizationProjectsService), [injector]);
	const refreshedEvent = useTypedEvent(DashboardRefreshedEvent);

	const [counts, setCounts] = useState<ICountsStatistics | null>(null);
	const [timeSlots, setTimeSlots] = useState<ITimeSlotStatistics[]>([]);
	const [activities, setActivities] = useState<IActivitiesStatistics[]>([]);
	const [projects, setProjects] = useState<IProjectsStatistics[]>([]);
	const [tasks, setTasks] = useState<ITasksStatistics[]>([]);
	const [manualTimes, setManualTimes] = useState<IManualTimesStatistics[]>([]);
	const [members, setMembers] = useState<IMembersStatistics[]>([]);
	const [loading, setLoading] = useState<StatisticsLoading>(INITIAL_LOADING);
	const [employeesCount, setEmployeesCount] = useState<number | undefined>(undefined);
	const [projectsCount, setProjectsCount] = useState<number | undefined>(undefined);

	// Latest inputs, readable from the stable fetch callbacks below.
	const selectionRef = useRef(selection);
	selectionRef.current = selection;
	const gatesRef = useRef({ isAllWidgetsHidden, isWindowHidden, canViewMembers, isEmployeeUser });
	gatesRef.current = { isAllWidgetsHidden, isWindowHidden, canViewMembers, isEmployeeUser };
	// Bumped on every selection change; a fetch only applies its result if still current.
	const generationRef = useRef(0);
	const isMountedRef = useRef(true);

	const setLoadingFlag = useCallback((key: keyof StatisticsLoading, value: boolean) => {
		if (!isMountedRef.current) return;
		setLoading((current) => (current[key] === value ? current : { ...current, [key]: value }));
	}, []);

	/** Runs one request with the shared loading/error/generation bookkeeping. */
	const runFetch = useCallback(
		async <T>(
			key: keyof StatisticsLoading,
			request: () => Promise<T>,
			apply: (result: T) => void,
			fallbackMessage: string
		): Promise<void> => {
			const generation = generationRef.current;
			// A response from a superseded selection must neither paint its data NOR clear the
			// spinner the CURRENT selection's request turned on.
			const isCurrent = () => isMountedRef.current && generation === generationRef.current;
			try {
				setLoadingFlag(key, true);
				const result = await request();
				if (isCurrent()) apply(result);
			} catch (error) {
				if (isCurrent()) toastrService.error((error as Error)?.message || fallbackMessage);
			} finally {
				if (isCurrent()) setLoadingFlag(key, false);
			}
		},
		[setLoadingFlag, toastrService]
	);

	const fetchCounts = useCallback(async () => {
		const payload = selectionRef.current?.payload;
		if (!payload || gatesRef.current.isAllWidgetsHidden()) return;
		await runFetch(
			'counts',
			() => statisticsService.getCounts(payload as IGetCountsStatistics),
			(result) => {
				setCounts(result);
				refreshedEvent.emit({
					employeesCount: result?.employeesCount ?? 0,
					projectsCount: result?.projectsCount ?? 0,
					todayDuration: result?.todayDuration ?? 0,
					weekDuration: result?.weekDuration ?? 0,
					refreshedAt: Date.now()
				});
			},
			'An error occurred while fetching counts.'
		);
	}, [runFetch, statisticsService, refreshedEvent]);

	const fetchTimeSlots = useCallback(async () => {
		const payload = selectionRef.current?.payload;
		if (!payload || gatesRef.current.isWindowHidden(Windows.RECENT_ACTIVITIES)) return;
		await runFetch(
			'timeSlots',
			() => statisticsService.getTimeSlots(payload as IGetTimeSlotStatistics),
			(result) => {
				const list = result || [];
				setTimeSlots(list);
				galleryService.appendItems(collectGalleryItems(list));
			},
			'An error occurred while fetching time slots.'
		);
	}, [runFetch, statisticsService, galleryService]);

	const fetchActivities = useCallback(async () => {
		const payload = selectionRef.current?.payload;
		if (!payload || gatesRef.current.isWindowHidden(Windows.APPS_URLS)) return;
		await runFetch(
			'activities',
			() => statisticsService.getActivities(payload as IGetActivitiesStatistics),
			(result) => setActivities(withDurationPercentage(result)),
			'An error occurred while fetching activities.'
		);
	}, [runFetch, statisticsService]);

	const fetchProjects = useCallback(async () => {
		const payload = selectionRef.current?.payload;
		if (!payload || gatesRef.current.isWindowHidden(Windows.PROJECTS)) return;
		await runFetch(
			'projects',
			() => statisticsService.getProjects(payload as IGetProjectsStatistics),
			(result) => setProjects(result || []),
			'An error occurred while fetching projects.'
		);
	}, [runFetch, statisticsService]);

	const fetchTasks = useCallback(async () => {
		const payload = selectionRef.current?.payload;
		if (!payload || gatesRef.current.isWindowHidden(Windows.TASKS)) return;
		await runFetch(
			'tasks',
			() => statisticsService.getTasksStatistics({ ...(payload as IGetTasksStatistics), take: 5 }),
			(result) => setTasks(result || []),
			'An error occurred while fetching tasks.'
		);
	}, [runFetch, statisticsService]);

	const fetchManualTimes = useCallback(async () => {
		const payload = selectionRef.current?.payload;
		if (!payload || gatesRef.current.isWindowHidden(Windows.MANUAL_TIMES)) return;
		await runFetch(
			'manualTimes',
			() => statisticsService.getManualTimes(payload as IGetManualTimesStatistics),
			(result) => setManualTimes(result || []),
			'An error occurred while fetching manual times.'
		);
	}, [runFetch, statisticsService]);

	const fetchMembers = useCallback(async () => {
		const payload = selectionRef.current?.payload;
		if (!payload || !gatesRef.current.canViewMembers || gatesRef.current.isWindowHidden(Windows.MEMBERS)) return;
		await runFetch(
			'members',
			() => statisticsService.getMembers(payload as IGetMembersStatistics),
			(result) => setMembers(normalizeMemberWeekHours(result)),
			'An error occurred while fetching members.'
		);
	}, [runFetch, statisticsService]);

	/** Angular `getStatistics()` behind `logs$`: clear the gallery, then everything in parallel. */
	const refresh = useCallback(async () => {
		if (!selectionRef.current) return;
		galleryService.clearGallery();
		await Promise.allSettled([
			fetchCounts(),
			fetchTimeSlots(),
			fetchActivities(),
			fetchProjects(),
			fetchTasks(),
			fetchManualTimes(),
			fetchMembers()
		]);
	}, [galleryService, fetchCounts, fetchTimeSlots, fetchActivities, fetchProjects, fetchTasks, fetchManualTimes, fetchMembers]);

	const recoverWindow = useCallback(
		async (position: Windows) => {
			switch (position) {
				case Windows.APPS_URLS:
					return fetchActivities();
				case Windows.MANUAL_TIMES:
					return fetchManualTimes();
				case Windows.MEMBERS:
					return fetchMembers();
				case Windows.PROJECTS:
					return fetchProjects();
				case Windows.RECENT_ACTIVITIES:
					return fetchTimeSlots();
				case Windows.TASKS:
					return fetchTasks();
				default:
					return;
			}
		},
		[fetchActivities, fetchManualTimes, fetchMembers, fetchProjects, fetchTimeSlots, fetchTasks]
	);

	/** Angular `loadEmployeesCount()` / `loadProjectsCount()` — the dot-strip denominators. */
	const loadCounters = useCallback(async () => {
		const organization = selectionRef.current?.organization;
		if (!organization) return;
		const { id: organizationId, tenantId } = organization;
		const generation = generationRef.current;
		if (!gatesRef.current.isEmployeeUser && employeesService) {
			firstValueFrom(employeesService.getCount({ organizationId, tenantId }))
				.then((count) => {
					if (isMountedRef.current && generation === generationRef.current) setEmployeesCount(count);
				})
				.catch((error) => console.error('Error loading employees count:', error));
		}
		try {
			const count = await projectsService.getCount({ organizationId, tenantId });
			if (isMountedRef.current && generation === generationRef.current) setProjectsCount(count);
		} catch (error) {
			console.error('Error loading project count:', error);
		}
	}, [employeesService, projectsService]);

	// Selection changed → new generation, reload the counters and (debounced) all statistics.
	const payloadKey = selection?.payloadKey ?? null;
	useEffect(() => {
		// Bump FIRST: even a cleared selection must invalidate the requests still in flight for
		// the previous one, or they would land after the fact.
		generationRef.current += 1;
		if (!payloadKey) return;
		void loadCounters();
		const handle = window.setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
		return () => window.clearTimeout(handle);
	}, [payloadKey, loadCounters, refresh]);

	// Auto-refresh: 5-minute timer while on, restarted on every selection change (Angular
	// calls `setAutoRefresh(true)` from the selection stream). `timer(0, …)` skips tick 0.
	useEffect(() => {
		if (!autoRefresh || !payloadKey) return;
		const handle = window.setInterval(() => void refresh(), AUTO_REFRESH_INTERVAL_MS);
		return () => window.clearInterval(handle);
	}, [autoRefresh, payloadKey, refresh]);

	// Angular `ngOnDestroy`: clear the gallery.
	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			galleryService.clearGallery();
		};
	}, [galleryService]);

	return {
		counts,
		timeSlots,
		activities,
		projects,
		tasks,
		manualTimes,
		members,
		loading,
		employeesCount,
		projectsCount,
		refresh,
		fetchCounts,
		recoverWindow
	};
}
