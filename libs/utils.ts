import * as moment from 'moment';

export function toUTC(data: string | Date | moment.Moment): moment.Moment {
	return moment(data).utc();
}

export function toLocal(data: string | Date | moment.Moment): moment.Moment {
	return moment.utc(data).local();
}

export function getContrastColor(hex: string) {
	const threshold = 130;
	const hexToRGB = (h) => {
		const hexValue = h.charAt(0) === '#' ? h.substring(1, 7) : h;
		return {
			red: parseInt(hexValue.substring(0, 2), 16),
			blue: parseInt(hexValue.substring(2, 4), 16),
			green: parseInt(hexValue.substring(4, 6), 16),
		};
	};
	const { red, green, blue } = hexToRGB(hex);
	const cBrightness = (red * 299 + green * 587 + blue * 114) / 1000;

	return cBrightness > threshold ? '#000000' : '#ffffff';
}
