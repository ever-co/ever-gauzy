import { GetSoundshotQueryHandler } from "./get-soundshot-query.handler";
import { ListSoundshotQueryHandler } from "./list-soundshot-query.handler";
import { GetSoundshotCountQueryHandler } from "./get-soundshot-count-query.handler";

export const queryHandlers = [
	ListSoundshotQueryHandler,
	GetSoundshotQueryHandler,
	GetSoundshotCountQueryHandler
];
