import { ITask } from "@gauzy/contracts";
import { IEvent } from "@nestjs/cqrs";

export class TaskCreatedEvent implements IEvent {

    constructor(
        public readonly input: ITask
    ) { }
}
