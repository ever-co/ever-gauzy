import { GetSoundshotCountQueryHandler } from './get-soundshot-count-query.handler';
import { GetSoundshotQueryHandler } from './get-soundshot-query.handler';
import { GetSoundshotsQueryHandler } from './get-soundshots-query.handler';

export const queryHandlers = [GetSoundshotQueryHandler, GetSoundshotsQueryHandler, GetSoundshotCountQueryHandler];
