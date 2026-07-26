import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, filter, switchMap, tap } from 'rxjs/operators';
import { IDashboardWidgetContext, EmployeesService } from '@gauzy/ui-core/core';
import { BaseTimeTrackCounterWidgetComponent } from './base-time-track-counter-widget.component';
import { TimeTrackCounterCardComponent } from './time-track-counter-card.component';

/**
 * Counter widget: how many members logged time in the selected range.
 *
 * The counter-point strip compares that number against the organization's total
 * head count, so an "8" reads very differently in a team of 9 than in a team of 90.
 */
@Component({
	selector: 'gz-members-worked-widget',
	templateUrl: './members-worked-widget.component.html',
	standalone: true,
	imports: [TimeTrackCounterCardComponent],
	// `EmployeesService` is a plain `@Injectable()` (NOT `providedIn: 'root'`) that
	// today is only provided by a handful of feature modules. A canvas widget is
	// created through the host's own injector and may be dropped on any page, so
	// it provides the service itself instead of gambling on a NullInjectorError.
	providers: [EmployeesService],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersWorkedWidgetComponent extends BaseTimeTrackCounterWidgetComponent implements OnInit {
	private readonly _employeesService = inject(EmployeesService);

	/** Total members in the organization — the counter-point denominator. */
	protected readonly totalEmployees = signal<number>(0);

	/** Members that logged time in the selected range. */
	protected readonly membersWorked = computed<number>(() => this.counts()?.employeesCount ?? 0);

	/**
	 * Starts the shared counts subscription and the organization head-count lookup.
	 */
	public override ngOnInit(): void {
		super.ngOnInit();
		this.observeEmployeesCount();
	}

	/**
	 * Keeps the total head count in sync with the active organization.
	 *
	 * A failure here only degrades the strip's scale, never the headline figure,
	 * so it is swallowed instead of surfacing an error state on the whole widget.
	 */
	private observeEmployeesCount(): void {
		this.context$
			.pipe(
				filter((context): context is IDashboardWidgetContext => !!context?.organizationId),
				switchMap((context: IDashboardWidgetContext) =>
					this._employeesService
						.getCount({ organizationId: context.organizationId, tenantId: context.tenantId })
						.pipe(catchError(() => of(0)))
				),
				tap((count: number) => this.totalEmployees.set(count || 0)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe();
	}
}
