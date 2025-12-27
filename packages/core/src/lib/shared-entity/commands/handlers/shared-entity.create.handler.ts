import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { ISharedEntity } from "@gauzy/contracts";
import { SharedEntityCreateCommand } from "../shared-entity.create.command";
import { SharedEntityService } from "../../shared-entity.service";

@CommandHandler(SharedEntityCreateCommand)
export class SharedEntityCreateHandler implements ICommandHandler<SharedEntityCreateCommand> {
    constructor(private readonly sharedEntityService: SharedEntityService) {}

    public async execute(command: SharedEntityCreateCommand): Promise<ISharedEntity> {
        const { input } = command;
        return await this.sharedEntityService.create(input);
    }
}
