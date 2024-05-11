import { Color, rgbString } from '@kurkle/color';

/**
 * A utility class for color operations.
 */
export class ColorAdapter {
	/**
	 * Converts a hexadecimal color value to RGB string format.
	 * @param hex The hexadecimal color value to convert.
	 * @returns The RGB string representation of the color.
	 */
	public static hex2Rgb(hex: string): string {
		hex = this.normalize(hex);
		return rgbString({
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
			a: 1
		});
	}

	/**
	 * Normalizes a hexadecimal color value by ensuring it starts with '#'.
	 * @param hex The hexadecimal color value to normalize.
	 * @returns The normalized hexadecimal color value.
	 */
	public static normalize(hex: string): string {
		const regex = /^#[0-9A-F]{6}$/i;
		if (regex.test(hex)) {
			return hex;
		} else {
			hex = '#' + hex;
			return regex.test(hex) ? hex : '#000000';
		}
	}

	/**
	 * Determines the contrast color for a given background color.
	 * @param bgColor The background color to determine the contrast color for.
	 * @returns The contrast color (either '#ffffff' or '#000000').
	 */
	public static contrast(bgColor: string): string {
		let color = new Color(bgColor);
		color = color.valid ? color : new Color(this.hex2Rgb(bgColor));
		const MIN_THRESHOLD = 128;
		const MAX_THRESHOLD = 186;
		const contrast = color.rgb ? color.rgb.r * 0.299 + color.rgb.g * 0.587 + color.rgb.b * 0.114 : null;
		if (contrast < MIN_THRESHOLD) {
			return '#ffffff';
		} else if (contrast > MAX_THRESHOLD) {
			return '#000000';
		}
	}

	/**
	 * Gets the background color, ensuring it's in a valid format.
	 * @param bgColor The background color to validate and return.
	 * @returns The valid background color.
	 */
	public static background(bgColor: string): string {
		const color = new Color(bgColor);
		return color.valid ? bgColor : this.normalize(bgColor);
	}

	/**
	 * Converts a hexadecimal color value to HSL string format.
	 * @param hexColor The hexadecimal color value to convert.
	 * @returns The HSL string representation of the color.
	 */
	public static hexToHsl(hexColor: string): string {
		let color = new Color(hexColor);
		color = color.valid ? color : new Color(this.hex2Rgb(hexColor));
		return color.hslString();
	}
}
