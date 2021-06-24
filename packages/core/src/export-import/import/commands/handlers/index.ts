import { ImportEntityFieldMapOrCreateHandler } from "./import-entity-field-map-or-create.handler";
import { ImportHistoryCreateHandler } from "./import-history-create.handler";
import { ImportRecordFindOrFailHandler } from "./import-record-find-or-fail.handler";
import { ImportRecordFirstOrCreateHandler } from "./import-record-first-or-create.handler";

export const CommandHandlers = [
    ImportEntityFieldMapOrCreateHandler,
    ImportHistoryCreateHandler,
    ImportRecordFindOrFailHandler,
    ImportRecordFirstOrCreateHandler
];
