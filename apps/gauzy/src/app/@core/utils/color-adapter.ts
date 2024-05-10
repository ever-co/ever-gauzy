import { Color, rgbString } from '@kurkle/color';

export class ColorAdapter {
	/**
	 *
	 * @param hex
	 * @returns
	 */
	public static hex2Rgb(hex: string) {
		hex = this.normalize(hex);
		return rgbString({
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
			a: 1
		});
	}

	/**
	 *
	 * @param hex
	 * @returns
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
	 *
	 * @param bgColor
	 * @returns
	 */
	public static contrast(bgColor: string) {
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
	 *
	 * @param bgColor
	 * @returns
	 */
	public static background(bgColor: string) {
		const color = new Color(bgColor);
		return color.valid ? bgColor : this.normalize(bgColor);
	}

	/**
	 *
	 * @param hexColor
	 * @returns
	 */
	public static hexToHsl(hexColor: string): string {
		let color = new Color(hexColor);
		color = color.valid ? color : new Color(this.hex2Rgb(hexColor));
		return color.hslString();
	}
}
