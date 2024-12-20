import { AutomationLabelSyncHandler } from "./automation-label.sync.handler";
import { TagCreateHandler } from "./tag-create.handler";
import { TagListHandler } from "./tag.list.handler";
import { TagUpdateHandler } from "./tag-update.handler";

export const CommandHandlers = [
	AutomationLabelSyncHandler,
	TagCreateHandler,
	TagListHandler,
	TagUpdateHandler
];
