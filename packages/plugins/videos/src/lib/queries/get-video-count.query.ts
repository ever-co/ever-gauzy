import { IQuery } from '@nestjs/cqrs';
import { CountVideoDTO } from '../dto/count-video.dto';

export class GetVideoCountQuery implements IQuery {
	public static readonly type = '[Video] Get Count';

	constructor(public readonly options: CountVideoDTO) {}
}
