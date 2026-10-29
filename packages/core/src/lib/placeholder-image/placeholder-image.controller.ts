import { BadRequestException, Controller, Get, Header, Param, Query, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@gauzy/common';
import { parsePlaceholderImage, PLACEHOLDER_IMAGE_MAX_SIZE } from './placeholder-image-url';
import { renderPlaceholderImage } from './placeholder-image.renderer';

/**
 * Draws the placeholder images of records that have no image of their own (see `getPlaceholderImageUrl`), in place of
 * the third-party dummyimage.com.
 *
 * Public: the image is drawn from the URL alone and shows nothing that is not in it, and it is shown wherever such a
 * record is (signed-in pages, the workspace picker of the sign-in, e-mails, the mobile apps).
 */
@ApiTags('Placeholder Image')
@Controller('/placeholder')
export class PlaceholderImageController {
	/**
	 * GET a placeholder image: `text` in white on `background`, as a PNG.
	 *
	 * The bytes depend on the URL only, so it is cached for a year. Any site may embed it (the API's default
	 * `Cross-Origin-Resource-Policy` is `same-site` in production).
	 *
	 * @param size - `<width>x<height>`, in pixels, each from 1 to 1024.
	 * @param background - The background, as 3 or 6 hex digits without `#`.
	 * @param text - The text, usually initials: only letters and digits are drawn, at most 4.
	 */
	@ApiOperation({ summary: 'Get a generated placeholder image (PNG).' })
	@ApiResponse({ status: 200, description: 'The placeholder image, as a PNG.' })
	@ApiResponse({ status: 400, description: 'The size or the background is not one that can be drawn.' })
	@Public()
	@Get('/:size/:background')
	@Header('Cache-Control', 'public, max-age=31536000, immutable')
	@Header('Cross-Origin-Resource-Policy', 'cross-origin')
	async getPlaceholderImage(
		@Param('size') size: string,
		@Param('background') background: string,
		@Query('text') text?: string | string[]
	): Promise<StreamableFile> {
		const image = parsePlaceholderImage(size, background, text);
		if (!image) {
			throw new BadRequestException(
				`A placeholder is <width>x<height>/<background>: sizes from 1 to ${PLACEHOLDER_IMAGE_MAX_SIZE} pixels, the background as 3 or 6 hex digits.`
			);
		}
		const png = await renderPlaceholderImage(image);
		return new StreamableFile(png, { type: 'image/png', length: png.length });
	}
}
