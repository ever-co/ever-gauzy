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
        const firstCityLetter = user.email
            .charAt(0)
            .toUpperCase();

        return getDummyImage(330, 300, firstCityLetter);
    }
}