import { ICommand } from '@nestjs/cqrs';
import { IScreenshotCreateInput } from '@gauzy/contracts';

export class ScreenshotCreateCommand implements ICommand {
	static readonly type = '[Screenshot] Create Screenshot';

	constructor(public readonly input: IScreenshotCreateInput) {}
}
