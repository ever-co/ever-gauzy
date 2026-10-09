export * from './lib/docs.constants';
export * from './lib/docs-ui.plugin';
export * from './lib/docs-ui.module';
// The record-side "Documents" panel (spec 00 §6.14 R-LNK-02) is a public entry
// point on purpose: business-record detail surfaces in `apps/gauzy` embed it
// directly. Both components are standalone, so a host NgModule adds them to its
// own `imports` without pulling in `DocsUiModule`.
export * from './lib/components/links/document-links-panel.component';
export * from './lib/components/links/document-attach-dialog.component';
export * from './lib/models/docs-api.model';
export * from './lib/models/docs-filter.model';
export * from './lib/models/docs-link.model';
export * from './lib/models/docs-saved-view.model';
export * from './lib/models/docs-share.model';
export * from './lib/services/documents.service';
export * from './lib/services/docs-export.service';
export * from './lib/services/docs-saved-views.service';
export * from './lib/services/document-permission.service';
export * from './lib/services/document-tree.store';
export * from './lib/services/upload-queue.service';
