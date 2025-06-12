import { IQuery } from "@nestjs/cqrs";
import { CountSoundshotDTO } from "../dtos/count-soundshot.dto";

export class GetSoundshotCountQuery implements IQuery {
	public static readonly type = '[Soundshot] Get Count';

	constructor(public readonly options: CountSoundshotDTO) { }
}
