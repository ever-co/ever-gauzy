import { Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2, inject } from '@angular/core';
import { environment } from '@gauzy/ui-config';
import { AVATAR_DEFAULT_SVG, DEFAULT_SVG } from '@gauzy/ui-core/common';

/**
 * Type for image fallback types supported by the directive.
 */
export type ImageType = 'user' | 'default';

/**
 * Static cache for default image URLs to avoid recomputation across instances.
 * Uses a Map for O(1) lookup performance.
 */
const DEFAULT_IMAGE_CACHE = new Map<string, string>();

/**
 * Resolves the default fallback image URL for the given image type.
 * Uses a static cache to avoid recomputing URLs across directive instances.
 *
 * @param type - The type of image ('user' for avatar, 'default' for generic)
 * @returns The resolved default image URL with environment-specific prefix
 */
function resolveDefaultImageUrl(type: ImageType): string {
	const cacheKey = `${type}-${environment.IS_ELECTRON}`;

	// Check cache first (O(1) lookup)
	const cached = DEFAULT_IMAGE_CACHE.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	// Resolve the appropriate SVG asset based on type
	const svgAsset = type === 'user' ? AVATAR_DEFAULT_SVG : DEFAULT_SVG;

	// Build URL with environment-specific prefix
	const url = environment.IS_ELECTRON ? `./${svgAsset}` : `/${svgAsset}`;

	// Cache for future lookups
	DEFAULT_IMAGE_CACHE.set(cacheKey, url);

	return url;
}

/**
 * Fast URL normalization check using regex for better performance.
 */
const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

/**
 * Directive that handles image loading with fallback to default images.
 * Optimized for performance with lazy initialization and efficient DOM operations.
 */
@Directive({
	selector: 'img',
	standalone: true
})
export class ImgDirective implements OnDestroy, OnInit {
	private readonly el = inject(ElementRef).nativeElement as HTMLImageElement;
	private readonly renderer = inject(Renderer2);

	@Input() type: ImageType = 'default';
	@Input() skipDefaultImage: boolean = false;
	@Input() enableFadeIn: boolean = true; // Make fade-in optional

	private listeners: Array<() => void> = [];
	private originalSrc: string | null = null;
	private isImageLoaded = false;
	private needsFadeIn = false;
	private rafId?: number;

	/**
	 * Normalizes the image source URL based on the environment.
	 * Optimized with regex check for absolute URLs.
	 */
	private normalizeSrc(src: string | null): string | null {
		if (!src) {
			return null;
		}

		// Fast check for absolute URLs using regex
		if (ABSOLUTE_URL_REGEX.test(src)) {
			return src;
		}

		// Add environment-specific prefix
		return environment.IS_ELECTRON ? `./${src}` : `/${src}`;
	}

	/**
	 * Checks if the image is already loaded (cached images).
	 * This allows us to skip unnecessary event listener setup.
	 */
	private isImageAlreadyLoaded(): boolean {
		return this.el.complete && this.el.naturalHeight > 0;
	}

	/**
	 * Applies styles in a batched manner using requestAnimationFrame for better performance.
	 */
	private applyStyles(styles: Record<string, string>): void {
		// Cancel any pending RAF
		if (this.rafId !== undefined) {
			cancelAnimationFrame(this.rafId);
		}

		this.rafId = requestAnimationFrame(() => {
			for (const [property, value] of Object.entries(styles)) {
				this.renderer.setStyle(this.el, property, value);
			}
			this.rafId = undefined;
		});
	}

	/**
	 * Initializes the directive by setting up the image source and event listeners.
	 * Optimized to skip work if image is already loaded.
	 */
	ngOnInit(): void {
		// Get and normalize the source
		const currentSrc = this.el.getAttribute('src');
		const normalizedSrc = this.normalizeSrc(currentSrc);

		if (normalizedSrc && normalizedSrc !== currentSrc) {
			this.renderer.setAttribute(this.el, 'src', normalizedSrc);
			this.originalSrc = normalizedSrc;
		} else if (normalizedSrc) {
			this.originalSrc = normalizedSrc;
		}

		// Check if image is already loaded (cached images)
		if (this.isImageAlreadyLoaded()) {
			this.isImageLoaded = true;
			// Image is already loaded, no need for fade-in or listeners
			return;
		}

		// Error listener is ESSENTIAL - we must handle broken images
		const errorCleanup = this.renderer.listen(this.el, 'error', () => this.handleError());
		this.listeners.push(errorCleanup);

		// Load listener: needed for fade-in effect OR to clean up error listener when image loads
		if (this.enableFadeIn) {
			this.needsFadeIn = true;
			this.applyStyles({
				opacity: '0',
				transition: 'opacity 0.2s ease-in-out'
			});
		}

		// Always set up load listener to clean up error listener when image loads successfully
		const loadCleanup = this.renderer.listen(this.el, 'load', () => this.handleLoad());
		this.listeners.push(loadCleanup);
	}

	/**
	 * Handles the error event when the image fails to load.
	 * This is the only essential listener - we must handle errors.
	 */
	private handleError(): void {
		if (this.isImageLoaded) {
			return;
		}

		// Remove error listener to prevent infinite loops
		this.cleanupListeners();

		if (this.skipDefaultImage) {
			// Hide the image instead of showing default
			this.renderer.setStyle(this.el, 'display', 'none');
			return;
		}

		// Store original source before replacing (only if not already stored)
		if (!this.originalSrc) {
			this.originalSrc = this.el.getAttribute('src');
		}

		// Get cached default fallback URL
		const defaultUrl = resolveDefaultImageUrl(this.type);

		// Batch DOM operations
		this.renderer.setAttribute(this.el, 'src', defaultUrl);
		if (this.originalSrc) {
			this.renderer.setAttribute(this.el, 'data-original-src', this.originalSrc);
		}

		// Use classList API for better performance
		this.el.classList.add('default-image', `default-image-${this.type}`);

		// Show the default image
		this.applyStyles({ opacity: '1' });
	}

	/**
	 * Handles the load event when the image successfully loads.
	 * Only needed for fade-in effect - could potentially be removed if fade-in isn't critical.
	 */
	private handleLoad(): void {
		this.isImageLoaded = true;

		// Only update styles if fade-in was set up
		if (this.needsFadeIn) {
			// Ensure element is visible (in case it was hidden)
			if (this.el.style.display === 'none') {
				this.renderer.removeStyle(this.el, 'display');
			}

			// Fade in the image
			this.applyStyles({ opacity: '1' });
		}

		// Clean up listeners as image is loaded (no longer needed)
		this.cleanupListeners();
	}

	/**
	 * Cleans up all event listeners at once.
	 */
	private cleanupListeners(): void {
		this.listeners.forEach((cleanup) => cleanup());
		this.listeners = [];
	}

	/**
	 * Cleans up all event listeners and pending animations when the directive is destroyed.
	 */
	ngOnDestroy(): void {
		// Cancel any pending animation frame
		if (this.rafId !== undefined) {
			cancelAnimationFrame(this.rafId);
			this.rafId = undefined;
		}

		// Clean up all listeners
		this.cleanupListeners();
	}
}
