import { ICommand } from "@nestjs/cqrs";
import { ID, ISharedEntityUpdateInput } from "@gauzy/contracts";

export class SharedEntityUpdateCommand implements ICommand {
    static readonly type = '[SharedEntity] Update';

    constructor(public readonly id: ID, public readonly input: ISharedEntityUpdateInput) {}
}
