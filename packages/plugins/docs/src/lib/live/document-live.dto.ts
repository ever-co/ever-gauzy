import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/** The connection a live session was opened with (`Subscription.documentLive(connectionId)`). */
const CONNECTION_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** `POST /plugins/docs/documents/:id/live/updates` */
export class DocumentLiveUpdateDTO {
	@ApiProperty({ type: () => String, description: 'The connection id the session was opened with.' })
	@IsString()
	@Matches(CONNECTION_ID)
	readonly connectionId: string;

	@ApiProperty({ type: () => String, description: 'A Yjs update of the page, base64.' })
	@IsString()
	@IsNotEmpty()
	@IsBase64()
	// The size limit itself is the service's (`GAUZY_DOCS_LIVE_MAX_UPDATE_BYTES`); this only bounds the parse.
	@MaxLength(64 * 1024 * 1024)
	readonly update: string;
}

/** `POST /plugins/docs/documents/:id/live/awareness` */
export class DocumentLiveAwarenessDTO {
	@ApiProperty({ type: () => String, description: 'The connection id the session was opened with.' })
	@IsString()
	@Matches(CONNECTION_ID)
	readonly connectionId: string;

	@ApiProperty({ type: () => String, description: 'A y-protocols awareness update, base64.' })
	@IsString()
	@IsNotEmpty()
	@IsBase64()
	@MaxLength(128 * 1024)
	readonly awareness: string;
}
