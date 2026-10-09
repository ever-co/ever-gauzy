// IMPORTANT: this barrel deliberately exports ONLY the registration arrays and
// the root provider — never the widget components themselves.
//
// Each `*.widgets.ts` is component-free: it holds plain config objects whose
// `loadComponent` is a dynamic `import()`. Re-exporting the per-folder barrels
// here (they DO export component classes, for tests) would pull every widget —
// and its chart/statistic dependencies — into whatever bundle imports this
// file. Since `provideCoreDashboardWidgets()` is referenced from the root
// bootstrap module, that means the INITIAL bundle: it blew the 150 MB budget by
// 8.8 MB and defeated the lazy loading these widgets are designed around.
//
// Import a component's folder barrel directly (`./accounting`) if you genuinely
// need the class at build time, e.g. in a unit test.
export * from './accounting/accounting.widgets';
export * from './charts/charts.widgets';
export * from './hr/hr.widgets';
export * from './project-management/project-management.widgets';
export * from './teams/teams.widgets';
export * from './provide-core-dashboard-widgets';
