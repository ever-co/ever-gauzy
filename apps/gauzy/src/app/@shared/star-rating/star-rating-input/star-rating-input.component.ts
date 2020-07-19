import { Component } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
	selector: 'ga-star-rating-input',
	templateUrl: './star-rating-input.component.html',
	styleUrls: ['./star-rating-input.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: StarRatingInputComponent,
			multi: true
		}
	]
})
export class StarRatingInputComponent implements ControlValueAccessor {
	public stars = [1, 2, 3, 4, 5];
	public currentRating = 0;
	public coloredStar = '';

	public onChange!: Function;
	public highlightRating: number | null = null;

	writeValue(rating: number): void {
		this.currentRating = rating || 0;
	}
	registerOnChange(fn: Function) {
		this.onChange = fn;
	}
	registerOnTouched(): void {}
	public starSelect(index: number) {
		this.currentRating = index;
		this.onChange(this.currentRating);
	}
	public starMouseEnter(index: number) {
		this.highlightRating = index + 1;
	}
	public starMouseLeave() {
		this.highlightRating = null;
	}
	public highlight(index: number) {
		if (
			!this.highlightRating ||
			this.highlightRating < this.currentRating
		) {
			return index < this.currentRating;
		}
		return index < this.highlightRating;
	}
}
