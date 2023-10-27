import { IEvent } from "@nestjs/cqrs";
import { ITask } from "@gauzy/contracts";

export class TaskCreatedEvent implements IEvent {

    constructor(
        public readonly input: ITask
    ) { }
}
