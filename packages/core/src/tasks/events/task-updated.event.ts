import { ITask } from "@gauzy/contracts";
import { IEvent } from "@nestjs/cqrs";

export class TaskUpdatedEvent implements IEvent {

    constructor(
        public readonly input: ITask
    ) { }
}
