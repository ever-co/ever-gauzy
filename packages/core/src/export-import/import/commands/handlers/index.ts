import { ImportHistoryCreateHandler } from "./import-history-create.handler";
import { ImportRecordFieldMapperHandler } from "./import-record-field-mapper.handler";
import { ImportRecordFirstOrCreateHandler } from "./import-record-first-or-create.handler";

export const CommandHandlers = [
    ImportHistoryCreateHandler,
    ImportRecordFirstOrCreateHandler,
    ImportRecordFieldMapperHandler
];
