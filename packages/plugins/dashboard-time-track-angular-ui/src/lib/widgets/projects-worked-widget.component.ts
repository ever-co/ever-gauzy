import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, from, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, retry, switchMap, tap } from 'rxjs/operators';
import { IDashboardWidgetContext, OrganizationProjectsService } from '@gauzy/ui-core/core';
import { BaseTimeTrackCounterWidgetComponent } from './base-time-track-counter-widget.component';
import { TimeTrackCounterCardComponent } from './time-track-counter-card.component';

/**
 * Counter widget: how many projects were worked on in the selected range,
 * scaled against the organization's total project count.
 */
@Component({
	selector: 'gz-projects-worked-widget',
	templateUrl: './projects-worked-widget.component.html',
	standalone: true,
	imports: [TimeTrackCounterCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsWorkedWidgetComponent extends BaseTimeTrackCounterWidgetComponent implements OnInit {
	private readonly _projectsService = inject(OrganizationProjectsService);

	/** Total projects in the organization — the counter-point denominator. */
	protected readonly totalProjects = signal<number>(0);

	/** Projects that received logged time in the selected range. */
	protected readonly projectsWorked = computed<number>(() => this.counts()?.projectsCount ?? 0);

	/**
	 * Starts the shared counts subscription and the organization project-count lookup.
	 */
	public override ngOnInit(): void {
		super.ngOnInit();
		this.observeProjectsCount();
	}

	/**
	 * Keeps the total project count in sync with the active organization.
	 *
	 * Wrapped in `defer` + `from` because `OrganizationProjectsService.getCount`
	 * returns a Promise — `defer` re-invokes it on retry, where a bare `from`
	 * would just replay the SAME settled promise. Failures only affect the
	 * strip's scale, so they are swallowed.
	 */
	private observeProjectsCount(): void {
		this.context$
			.pipe(
				filter((context): context is IDashboardWidgetContext => !!context?.organizationId),
				// The project count depends on the organization ALONE, so a date-range
				// change must not re-issue it (see the Members Worked widget).
				distinctUntilChanged(
					(previous: IDashboardWidgetContext, current: IDashboardWidgetContext) =>
						previous.organizationId === current.organizationId && previous.tenantId === current.tenantId
				),
				switchMap((context: IDashboardWidgetContext) =>
					defer(() =>
						from(
							this._projectsService.getCount({
								organizationId: context.organizationId,
								tenantId: context.tenantId
							})
						)
					).pipe(
						retry({ count: 1, delay: 1_000 }),
						catchError(() => of(0))
					)
				),
				tap((count: number) => this.totalProjects.set(count || 0)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}
}
