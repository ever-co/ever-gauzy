import { ICommand } from '@nestjs/cqrs';
import { ICreateScreenshotInput } from '@gauzy/models';

export class ScreenshotCreateCommand implements ICommand {
	static readonly type = '[Screenshot] Create Screenshot';

	constructor(public readonly input: ICreateScreenshotInput) {}
}
