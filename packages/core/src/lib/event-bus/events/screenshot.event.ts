import { IScreenshot, UploadedFile } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { Screenshot } from '../../core/entities/internal';
import { BaseEntityEvent, BaseEntityEventType } from '../base-entity-event';

type ScreenshotInputTypes = IScreenshot;

/**
 * Event class representing an screenshot events.
 */
export class ScreenshotEvent extends BaseEntityEvent<Screenshot, ScreenshotInputTypes> {
	public readonly data: Buffer;
	public readonly file?: UploadedFile;
	/**
	 * Creates an instance of ScreenshotEvent.
	 *
	 * @param {RequestContext} ctx - The context object containing information about the request.
	 * @param {Screenshot} entity - The screenshot entity associated with the event.
	 * @param {BaseEntityEventType} type - The type of the event.
	 * @param {ScreenshotInputTypes} [input] - Optional input data for the event.
	 */
	constructor(
		ctx: RequestContext,
		entity: Screenshot,
		type: BaseEntityEventType,
		input?: ScreenshotInputTypes,
		data?: Buffer,
		file?: UploadedFile
	) {
		super(entity, type, ctx, input);
		this.file = file;
		this.data = data;
	}
}
