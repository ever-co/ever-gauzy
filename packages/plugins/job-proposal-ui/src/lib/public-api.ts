/**
 * Public API Surface of @gauzy/plugin-job-proposal-ui
 */
// Proposal Templates Module and Routes
export * from './proposal-template/job-proposal-template.module';
export * from './proposal-template/job-proposal-template.routes';

// Proposal Template Components
export * from './proposal-template/components/add-edit-proposal-template/add-edit-proposal-template.component';
export * from './proposal-template/components/proposal-template/proposal-template.component';

// Proposals Module and Routes
export * from './proposal/job-proposal.module';
export * from './proposal/job-proposal.routes';

// Proposal Components
export * from './proposal/components/proposal-layout.component';
export * from './proposal/components/proposal-register/proposal-register.component';
export * from './proposal/components/proposal-details/proposal-details.component';
export * from './proposal/components/proposal-edit/proposal-edit.component';
export * from './proposal/components/proposal-pie-chart/proposal-pie-chart.component';

// Table Components
export * from './proposal/components/table-components/job-title/job-title.component';
export * from './proposal/components/table-components/proposal-status/proposal-status.component';

// Proposal Resolvers
export * from './proposal/resolvers/proposal-details.resolver';
