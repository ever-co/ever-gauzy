import { ApiProperty } from '@nestjs/swagger';
import { ID, IEmbedClientReport, IEmbedClientReportInput, IEmbedClientReportProject } from '@gauzy/contracts';

/**
 * `POST /api/embed/client-report`
 *
 * Carries no validators, and the route runs no validation pipe, as the exchange: a malformed credential gets the same
 * 401 as a revoked one.
 */
export class EmbedClientReportDTO implements IEmbedClientReportInput {
	@ApiProperty({
		type: () => String,
		description: "A credential limited to one client, from its portal's server only."
	})
	credential: string;
}

export class EmbedClientReportClientDTO {
	@ApiProperty({ type: () => String })
	id: ID;

	@ApiProperty({ type: () => String })
	name: string;
}

export class EmbedClientReportDayDTO {
	@ApiProperty({ type: () => String, example: '2026-11-19' })
	date: string;

	@ApiProperty({ type: () => Number })
	seconds: number;
}

export class EmbedClientReportWeekDTO {
	@ApiProperty({ type: () => String, example: '2026-11-16' })
	start: string;

	@ApiProperty({ type: () => String, example: '2026-11-22' })
	end: string;

	@ApiProperty({ type: () => Number })
	seconds: number;
}

export class EmbedClientReportProjectDTO implements IEmbedClientReportProject {
	@ApiProperty({ type: () => String })
	id: ID;

	@ApiProperty({ type: () => String })
	name: string;

	@ApiProperty({ type: () => Number, description: 'Seconds spent on it this week.' })
	seconds: number;
}

/** The answer of `POST /api/embed/client-report`, for the API's documentation. */
export class EmbedClientReportResponseDTO implements IEmbedClientReport {
	@ApiProperty({ type: () => EmbedClientReportClientDTO })
	client: EmbedClientReportClientDTO;

	@ApiProperty({ type: () => String, description: "The organization's time zone, or UTC.", example: 'Europe/Paris' })
	timeZone: string;

	@ApiProperty({ type: () => EmbedClientReportDayDTO })
	today: EmbedClientReportDayDTO;

	@ApiProperty({ type: () => EmbedClientReportWeekDTO })
	week: EmbedClientReportWeekDTO;

	@ApiProperty({
		type: () => EmbedClientReportProjectDTO,
		isArray: true,
		description: 'With time this week, most first.'
	})
	projects: EmbedClientReportProjectDTO[];
}
