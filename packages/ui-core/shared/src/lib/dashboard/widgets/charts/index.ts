/**
 * Employee statistics chart widgets for the dashboard builder.
 *
 * NOTE: this barrel is for direct/eager consumers (tests, future modules). The
 * widget registry in `charts.widgets.ts` deliberately imports each component
 * through its own `loadComponent` dynamic import so a canvas only pays for the
 * charts it actually renders — importing this barrel from application code
 * would pull all four bundles in eagerly.
 */
// `employee-chart.utils` re-exports `employee-chart.constants`, so the constants
// are covered here without a second `export *` (which would be an ambiguous
// re-export of the same symbols).
export * from './employee-chart.utils';
export * from './employee-month-statistics-cache.service';
export * from './employee-chart-card.component';
export * from './base-employee-chart-widget.component';
export * from './employee-doughnut-chart-widget.component';
export * from './employee-horizontal-bar-chart-widget.component';
export * from './employee-stacked-bar-chart-widget.component';
export * from './employee-statistics-chart-widget.component';
export * from './charts.widgets';
