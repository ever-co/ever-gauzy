/**
 * Human Resources dashboard widgets.
 *
 * NOTE: this barrel is for direct/eager consumers (tests, the module that
 * registers the widgets). The registry in `hr.widgets.ts` deliberately imports
 * each component through its own `loadComponent` dynamic import so a canvas only
 * pays for the blocks it actually renders.
 */
export * from './hr-statistics.utils';
export * from './hr-statistics-cache.service';
export * from './hr-info-card.component';
export * from './base-hr-info-widget.component';
export * from './hr-total-income-widget.component';
export * from './hr-income-widget.component';
export * from './hr-direct-income-widget.component';
export * from './hr-expenses-without-salary-widget.component';
export * from './hr-total-expenses-widget.component';
export * from './hr-profit-widget.component';
export * from './hr-total-direct-bonus-widget.component';
export * from './hr-profit-bonus-widget.component';
export * from './hr-revenue-bonus-widget.component';
export * from './hr.widgets';
