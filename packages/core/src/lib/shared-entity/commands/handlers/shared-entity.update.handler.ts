import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { UpdateResult } from "typeorm";
import { ISharedEntity } from "@gauzy/contracts";
import { SharedEntityUpdateCommand } from "../shared-entity.update.command";
import { SharedEntityService } from "../../shared-entity.service";

@CommandHandler(SharedEntityUpdateCommand)
export class SharedEntityUpdateHandler implements ICommandHandler<SharedEntityUpdateCommand> {
    constructor(private readonly sharedEntityService: SharedEntityService) {}

    public async execute(command: SharedEntityUpdateCommand): Promise<ISharedEntity | UpdateResult> {
        const { id, input } = command;
        return await this.sharedEntityService.update(id, input);
    }
}
