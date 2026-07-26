/**
 * Time Tracking dashboard widgets.
 *
 * NOTE: this barrel is for direct/eager consumers (tests, future modules). The
 * widget registry in `dashboard-time-track.widgets.ts` deliberately imports each
 * component through its own `loadComponent` dynamic import so a canvas only pays
 * for the widgets it actually renders.
 */
export * from './time-track-widget.utils';
export * from './time-track-counter-card.component';
export * from './base-time-track-counter-widget.component';
export * from './members-worked-widget.component';
export * from './projects-worked-widget.component';
export * from './today-activity-widget.component';
export * from './worked-today-widget.component';
export * from './worked-this-week-widget.component';
export * from './weekly-activity-widget.component';
export * from './dashboard-time-track.widgets';
