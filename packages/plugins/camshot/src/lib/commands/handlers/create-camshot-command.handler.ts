import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CreateCamshotCommand } from "../create-camshot.command";
import { CamshotService } from "../../services/camshot.service";
import { ICamshot } from "../../models/camshot.model";
import { Camshot } from "../../entity/camshot.entity";
import { CamshotFactory } from "../../shared/camshot.factory";

@CommandHandler(CreateCamshotCommand)
export class CreateCamshotCommandHandler implements ICommandHandler<CreateCamshotCommand> {
	constructor(private readonly camshotService: CamshotService) { }

	public async execute(command: CreateCamshotCommand): Promise<ICamshot> {
		// Extract the input and file from the command
		const { input, file } = command;
		// Prepare the file
		const { thumbnail, storageProvider } = await this.camshotService.prepare(file);
		// Create the camshot record
		const camshot = Object.assign(
			new Camshot(),
			CamshotFactory.create(input),
			{
				fileKey: file.key,
				thumbKey: thumbnail.key,
				title: file.originalname,
				storageProvider,
				size: file.size,
			}
		)

		// Create the camshot record
		return this.camshotService.create(camshot);
	}
}
