/**
 * Accounting dashboard widgets.
 *
 * NOTE: this barrel is for direct/eager consumers (tests, the registration
 * call). The widget registry in `accounting.widgets.ts` deliberately imports
 * each component through its own `loadComponent` dynamic import so a canvas only
 * pays for the widgets it actually renders.
 */
export * from './accounting-statistics-cache.service';
export * from './accounting-statistic-card.component';
export * from './base-accounting-widget.component';
export * from './base-employee-history-widget.component';
export * from './cash-flow-chart.utils';
export * from './records-history.constants';
export * from './total-income-widget.component';
export * from './total-expenses-widget.component';
export * from './profit-widget.component';
export * from './total-bonus-widget.component';
export * from './cash-flow-widget.component';
export * from './employee-statistics-widget.component';
export * from './records-history-widget.component';
export * from './profit-history-widget.component';
export * from './accounting.widgets';
