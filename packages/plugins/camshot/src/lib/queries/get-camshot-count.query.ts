import { IQuery } from "@nestjs/cqrs";
import { CountCamshotDTO } from "../dtos/count-camshot.dto";

export class GetCamshotCountQuery implements IQuery {
	public static readonly type = '[Camshot] Get Count';

	constructor(public readonly options: CountCamshotDTO) { }
}
