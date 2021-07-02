import { ImportRecordFindOrFailHandler } from "./import-record-find-or-fail.handler";
import { ImportRecordFirstOrCreateHandler } from "./import-record-first-or-create.handler";

export const CommandHandlers = [
    ImportRecordFindOrFailHandler,
    ImportRecordFirstOrCreateHandler
];
