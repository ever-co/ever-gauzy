import { TaskCreatedEventHandler } from "./task-created.handler";
import { TaskUpdatedEventHandler } from "./task-updated.handler";

export const EventHandlers = [
    TaskCreatedEventHandler,
    TaskUpdatedEventHandler,
];
