/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */

import { DomSanitizer } from '@angular/platform-browser';
import { Pipe, PipeTransform } from '@angular/core';
import { icons } from 'eva-icons';

@Pipe({ name: 'eva' })
export class EvaIconsPipe implements PipeTransform {
	private defaultOptions = {
		height: 24,
		width: 24,
		fill: 'inherit',
		animationHover: true,
		animationInfinity: false
	};

	constructor(private readonly sanitizer: DomSanitizer) {}

	/**
	 * Transforms an icon name into an SVG element
	 *
	 * @param icon Icon name
	 * @param options Options to customize the SVG
	 * @return SVG element
	 */
	transform(
		icon: string,
		options: {
			height: number;
			width: number;
			fill: string;
			animationType?: string;
			animationHover?: boolean;
			animationInfinity?: boolean;
		}
	) {
		// Merge default options with the provided options
		const mergedOptions = {
			...this.defaultOptions,
			...options
		};
		const { width, height, fill, animationType, animationHover, animationInfinity } = mergedOptions;
		const animation = animationType
			? { type: animationType, hover: animationHover, infinite: animationInfinity }
			: null;

		// Sanitize the SVG to prevent XSS attacks
		return this.sanitizer.bypassSecurityTrustHtml(
			icons[icon].toSvg({
				width,
				height,
				fill,
				animation
			})
		);
	}
}
