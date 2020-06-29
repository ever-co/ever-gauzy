import { HelpCenterCreateHandler } from './help-center.bulk.handler';
import { KnowledgeBaseCategoryBulkDeleteHandler } from './help-center.menu.bulk.delete.handler';

export const CommandHandlers = [
	KnowledgeBaseCategoryBulkDeleteHandler,
	HelpCenterCreateHandler
];
