import { TagCreateHandler } from "./tag-create.handler";
import { TagUpdateHandler } from "./tag-update.handler";
import { TagListHandler } from "./tag.list.handler";

export const CommandHandlers = [
	TagListHandler,
	TagCreateHandler,
	TagUpdateHandler
];
