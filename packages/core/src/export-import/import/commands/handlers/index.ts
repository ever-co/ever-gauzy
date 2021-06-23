import { ImportEntityFieldMapperHandler } from "./import-entity-field-mapper.handler";
import { ImportHistoryCreateHandler } from "./import-history-create.handler";
import { ImportRecordFindOrFailHandler } from "./import-record-find-or-fail.handler";
import { ImportRecordFirstOrCreateHandler } from "./import-record-first-or-create.handler";

export const CommandHandlers = [
    ImportEntityFieldMapperHandler,
    ImportHistoryCreateHandler,
    ImportRecordFindOrFailHandler,
    ImportRecordFirstOrCreateHandler
];
