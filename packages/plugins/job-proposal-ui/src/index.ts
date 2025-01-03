/**
 * Public API Surface of @gauzy/plugin-job-proposal-ui
 */
// Proposal Templates Module and Routes
export * from './lib/proposal-template/job-proposal-template.module';
export * from './lib/proposal-template/job-proposal-template.routes';

// Proposal Template Components
export * from './lib/proposal-template/components/add-edit-proposal-template/add-edit-proposal-template.component';
export * from './lib/proposal-template/components/proposal-template/proposal-template.component';

// Proposals Module and Routes
export * from './lib/proposal/job-proposal.module';
export * from './lib/proposal/job-proposal.routes';

// Proposal Components
export * from './lib/proposal/components/proposal-layout.component';
export * from './lib/proposal/components/proposal-register/proposal-register.component';
export * from './lib/proposal/components/proposal-details/proposal-details.component';
export * from './lib/proposal/components/proposal-edit/proposal-edit.component';
export * from './lib/proposal/components/proposal-pie-chart/proposal-pie-chart.component';

// Table Components
export * from './lib/proposal/components/table-components/job-title/job-title.component';
export * from './lib/proposal/components/table-components/proposal-status/proposal-status.component';

// Proposal Resolvers
export * from './lib/proposal/resolvers/proposal-details.resolver';
