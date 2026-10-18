import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import * as moment from 'moment-timezone';
import { IOrganization } from '@gauzy/contracts';
import { OrganizationProjectsService, Store } from '@gauzy/ui-core/core';
import { RecordViewPageState, recordViewPageStateOf } from '@gauzy/ui-core/shared';
import { IProjectQuickLookCard } from '../project-quick-look/project-quick-look.component';

/** The windows the page's figures can be read over — the same as the team and employee pages. */
export enum ProjectViewPeriod {
	THIS_WEEK = 'THIS_WEEK',
	THIS_MONTH = 'THIS_MONTH',
	LAST_30_DAYS = 'LAST_30_DAYS'
}

/** The page's tabs, in the manner of Jira's project pages; the open one is in the URL (`?tab=`). */
export type ProjectViewTab = 'overview' | 'board' | 'planning' | 'time' | 'activity';

const TABS: ProjectViewTab[] = ['overview', 'board', 'planning', 'time', 'activity'];

/** Tabs whose figures read over the period, and so show the period switcher. */
const PERIOD_TABS = new Set<ProjectViewTab>(['overview', 'planning', 'time']);

/**
 * A project on its own page, `/pages/organization/projects/view/:id`: what the project list's View
 * button opens. The URL is the project's — bookmark it, share it, reload it. Its body is the project
 * quick look the team and employee pages open in a drawer, laid out as a page, over everyone's time
 * on the project in the chosen period.
 *
 * The page belongs to the organization selected in the header, like the list: a project of another
 * organization reads "not found", and switching the organization reloads the page.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-project-view-page',
	templateUrl: './project-view-page.component.html',
	styleUrls: ['../../../employees/view-employee/view-employee.component.scss', './project-view-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ProjectViewPageComponent implements OnInit {
	/** The list a project belongs to, for the page's back button. */
	readonly backLink = '/pages/organization/projects';
	readonly periods: ProjectViewPeriod[] = Object.values(ProjectViewPeriod);
	readonly tabs: { id: ProjectViewTab; label: string; icon: string }[] = [
		{ id: 'overview', label: 'PROJECT_VIEW.TABS.OVERVIEW', icon: 'home-outline' },
		{ id: 'board', label: 'PROJECT_VIEW.TABS.BOARD', icon: 'grid-outline' },
		{ id: 'planning', label: 'PROJECT_VIEW.TABS.PLANNING', icon: 'activity-outline' },
		{ id: 'time', label: 'PROJECT_VIEW.TABS.TIME', icon: 'clock-outline' },
		{ id: 'activity', label: 'PROJECT_VIEW.TABS.ACTIVITY', icon: 'list-outline' }
	];
	tab: ProjectViewTab = 'overview';

	state: RecordViewPageState = 'loading';
	/** The project as the quick look opens it: its name and logo; the quick look reads the rest. */
	card: IProjectQuickLookCard | null = null;
	organization: IOrganization | null = null;

	readonly period$ = new BehaviorSubject<ProjectViewPeriod>(ProjectViewPeriod.THIS_WEEK);
	get period(): ProjectViewPeriod {
		return this.period$.getValue();
	}
	set period(value: ProjectViewPeriod) {
		this.period$.next(value);
	}

	private projectId: string | null = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store,
		private readonly projectsService: OrganizationProjectsService
	) {}

	ngOnInit(): void {
		// The component is reused across `view/:id` navigations, and the page follows the header's
		// organization: either changing reloads.
		const id$ = this.route.paramMap.pipe(
			map((params) => params.get('id')),
			filter((id): id is string => !!id),
			distinctUntilChanged()
		);
		const organization$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			distinctUntilChanged((a: IOrganization, b: IOrganization) => a.id === b.id)
		);
		combineLatest([id$, organization$])
			.pipe(untilDestroyed(this))
			.subscribe(([id, organization]) => {
				this.projectId = id;
				this.organization = organization;
				void this.load();
			});
		// The open tab follows the URL, so a tab can be bookmarked, shared and reached with Back.
		this.route.queryParamMap
			.pipe(
				map((params) => params.get('tab') as ProjectViewTab),
				distinctUntilChanged(),
				untilDestroyed(this)
			)
			.subscribe((tab) => (this.tab = TABS.includes(tab) ? tab : 'overview'));
	}

	/** Opens a tab, keeping it in the URL without a new history entry per click. */
	selectTab(tab: ProjectViewTab): void {
		this.tab = tab;
		void this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { tab: tab === 'overview' ? null : tab },
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
	}

	/** Whether the open tab reads over the period, and so shows the period switcher. */
	get showsPeriod(): boolean {
		return PERIOD_TABS.has(this.tab);
	}

	/** Loads (or reloads, after an error) the project the URL names. */
	async load(): Promise<void> {
		const id = this.projectId;
		const organization = this.organization;
		if (!id || !organization) return;

		const sequence = ++this.loadSequence;
		// Nothing of the previous project (or organization) stays on screen.
		this.card = null;
		this.state = 'loading';
		try {
			const project = await firstValueFrom(this.projectsService.getById(id, ['image']));
			if (sequence !== this.loadSequence) return; // a newer navigation or organization switch owns the page
			if (!project?.id || (project.organizationId && project.organizationId !== organization.id)) {
				throw { status: 404 };
			}
			this.card = {
				id: project.id,
				name: project.name,
				imageUrl: project.imageUrl || project.image?.fullUrl,
				initials: ProjectViewPageComponent.initialsOf(project.name)
			};
			this.state = 'ready';
		} catch (error) {
			if (sequence !== this.loadSequence) return;
			this.card = null;
			this.state = recordViewPageStateOf(error);
		}
	}

	/** "Oct 12 – Oct 18, 2026": the window the page's figures cover. */
	get rangeLabel(): string {
		const { start, end } = this.periodRange();
		const sameYear = start.year() === end.year();
		return `${start.format(sameYear ? 'MMM D' : 'll')} – ${end.format('ll')}`;
	}

	/** The period as ISO dates — stable strings, so the quick look reloads only when the window moves. */
	get periodStartIso(): string {
		return this.periodRange().start.toISOString();
	}

	get periodEndIso(): string {
		return this.periodRange().end.toISOString();
	}

	private periodRange(): { start: moment.Moment; end: moment.Moment } {
		switch (this.period) {
			case ProjectViewPeriod.THIS_MONTH:
				return { start: moment().startOf('month'), end: moment().endOf('month') };
			case ProjectViewPeriod.LAST_30_DAYS:
				return { start: moment().subtract(29, 'days').startOf('day'), end: moment().endOf('day') };
			case ProjectViewPeriod.THIS_WEEK:
			default:
				return { start: moment().startOf('week'), end: moment().endOf('week') };
		}
	}

	private static initialsOf(name: string): string {
		return (name || '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('');
	}
}
