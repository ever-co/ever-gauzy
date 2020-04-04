import { sample } from 'lodash';
import { User as IUser } from '@gauzy/models';

namespace Utils {
	export function generatedLogoColor() {
		return sample(['#269aff', '#ffaf26', '#8b72ff', '#0ecc9D']).replace(
			'#',
			''
		);
	}
}

export const getDummyImage = (
	width: number,
	height: number,
	letter: string
) => {
	return `https://dummyimage.com/${width}x${height}/${Utils.generatedLogoColor()}/ffffff.jpg&text=${letter}`;
};

export const getUserDummyImage = (user: IUser) => {
	const firstNameLetter = user.firstName
		? user.firstName.charAt(0).toUpperCase()
		: '';
	if (firstNameLetter) {
		return getDummyImage(330, 300, firstNameLetter);
	} else {
		const firstCityLetter = user.email.charAt(0).toUpperCase();

		return getDummyImage(330, 300, firstCityLetter);
	}
};

export function reflect(promise) {
	return promise.then(
		(item) => ({ item, status: 'fulfilled' }),
		(error) => ({ error, status: 'rejected' })
	);
}

/**
 * To calculate the last day of a month, we need to set date=0 and month as the next month.
 * So, if we want the last day of February (February is month = 1) we'll need to perform 'new Date(year, 2, 0).getDate()'
 */
export function getLastDayOfMonth(year, month) {
	return new Date(year, month + 1, 0).getDate();
}
