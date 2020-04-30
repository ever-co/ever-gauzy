import { Component, Input } from '@angular/core';

export enum StarsIcon {
	FILLED = 'star',
	HALF = 'star-half',
	BORDERED = 'star-outline'
}

@Component({
	selector: 'ga-star-rating-output',
	templateUrl: './star-rating-output.component.html',
	styleUrls: ['./star-rating-output.component.scss']
})
export class StarRatingOutputComponent {
	@Input()
	public set rate(rate: number | null) {
		if (rate === null) {
			rate = 0;
		}
		const integerPart = Math.floor(rate);
		const doublePart = rate % 1;
		for (let i = 0; i < this.starsCount; i++) {
			if (i > integerPart) {
				this.stars.push({ icon: StarsIcon.BORDERED, active: false });
				continue;
			}
			if (i < integerPart) {
				this.stars.push({ icon: StarsIcon.FILLED, active: true });
				continue;
			}
			if (0 <= doublePart && doublePart < 0.25) {
				this.stars.push({ icon: StarsIcon.BORDERED, active: false });
				continue;
			}
			if (doublePart > 0.25 && doublePart < 0.75) {
				this.stars.push({ icon: StarsIcon.HALF, active: true });
				continue;
			}
			if (doublePart >= 0.75) {
				this.stars.push({ icon: StarsIcon.FILLED, active: true });
			}
		}
	}

	public stars: { icon: StarsIcon; active: boolean }[] = [];
	public starsCount = 5;
}
