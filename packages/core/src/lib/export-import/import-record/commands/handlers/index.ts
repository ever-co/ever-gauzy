import { ImportRecordFindOrFailHandler } from "./import-record-find-or-fail.handler";
import { ImportRecordUpdateOrCreateHandler } from "./import-record-update-or-create.handler";

export const CommandHandlers = [
    ImportRecordFindOrFailHandler,
    ImportRecordUpdateOrCreateHandler
];
