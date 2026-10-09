import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IEmployeeStatisticSum } from '@gauzy/contracts';
import { ComponentsModule } from '../../../components/components.module';
import { TeamsWidgetStateComponent } from '../teams/teams-widget-state.component';
import { BaseAccountingWidgetComponent } from './base-accounting-widget.component';

/**
 * Per-employee income / expenses / profit (and bonus) breakdown — the table at
 * the bottom of the Accounting page, on a canvas.
 *
 * It projects the SAME `/employee-statistics/aggregate` response as the four
 * Accounting KPIs and the cash-flow chart, so adding it to a canvas that already
 * shows them costs no extra request (see `AccountingStatisticsCacheService`).
 *
 * Two deliberate differences from the page's table:
 *
 * 1. The row is not a click target. On the page a click selects the employee and
 *    navigates to the HR dashboard; a widget cannot navigate the user away from
 *    their own dashboard, and silently rewriting the canvas-wide employee
 *    selection from a table row would re-scope every other widget on the canvas.
 *    The avatar keeps its own (existing) link to the employee's profile.
 * 2. The bonus column follows the organization's bonus type exactly like the page
 *    — no bonus scheme, no column, rather than a permanent zero.
 */
@Component({
	selector: 'ga-accounting-employee-statistics-widget',
	templateUrl: './employee-statistics-widget.component.html',
	styleUrls: ['./employee-statistics-widget.component.scss'],
	standalone: true,
	imports: [TranslateModule, ComponentsModule, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeStatisticsWidgetComponent extends BaseAccountingWidgetComponent {
	/** One row per employee with bookings in the range; empty before the first fetch. */
	protected readonly rows = computed<IEmployeeStatisticSum[]>(() => this.statistics()?.employees ?? []);

	/** True when the query succeeded but nobody in the organization has figures. */
	protected readonly isEmpty = computed<boolean>(() => this.rows().length === 0);

	/**
	 * Money figure of one row, formatted with the organization's currency and
	 * symbol position.
	 *
	 * Exposed for the template rather than piped there so the widget does not have
	 * to provide `CurrencyPipe`/`CurrencyPositionPipe` — the base class already
	 * owns both, precisely because a canvas widget is built by the host's injector.
	 *
	 * @param amount - The raw amount of the row, possibly missing.
	 * @returns The formatted figure.
	 */
	protected format(amount: number | undefined): string {
		return this.formatCurrency(amount ?? 0);
	}

	/**
	 * Stable identity of a row for `@for`.
	 *
	 * Falls back to the index because the aggregate payload can carry a row whose
	 * employee was deleted, and two such rows would otherwise collide on
	 * `undefined` and make Angular re-create the list on every refresh.
	 *
	 * @param index - Position of the row.
	 * @param row - The row being rendered.
	 * @returns A key unique within the list.
	 */
	protected trackRow(index: number, row: IEmployeeStatisticSum): string {
		return row?.employee?.id ?? `index:${index}`;
	}
}
