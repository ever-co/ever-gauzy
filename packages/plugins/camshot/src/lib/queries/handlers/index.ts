import { GetCamshotQueryHandler } from "./get-camshot-query.handler";
import { ListCamshotQueryHandler } from "./list-camshot-query.handler";
import { GetCamshotCountQueryHandler } from "./get-camshot-count-query.handler";

export const queryHandlers = [
	ListCamshotQueryHandler,
	GetCamshotQueryHandler,
	GetCamshotCountQueryHandler
];
