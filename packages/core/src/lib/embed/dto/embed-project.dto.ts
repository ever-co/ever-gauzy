import { ApiProperty } from '@nestjs/swagger';
import { ID, IEmbedProject } from '@gauzy/contracts';

/** `GET /api/embed/projects`: a project an embed token may track time on, by its id and its name only. */
export class EmbedProjectResponseDTO implements IEmbedProject {
	@ApiProperty({ type: () => String })
	id: ID;

	@ApiProperty({ type: () => String })
	name: string;
}
