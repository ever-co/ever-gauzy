import { HelpCenterCreateHandler } from './help-center.bulk.handler';
import { KnowledgeBaseBulkDeleteHandler } from './help-center-base.bulk.handler';

export const CommandHandlers = [
	HelpCenterCreateHandler,
	KnowledgeBaseBulkDeleteHandler
];
