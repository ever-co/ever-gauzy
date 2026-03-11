import {
	Directive,
	Input,
	ElementRef,
	AfterViewInit,
	OnChanges,
	HostListener,
	inject
} from '@angular/core';

@Directive({
	selector: '[readMore]',
	standalone: true
})
export class ReadMoreDirective implements AfterViewInit, OnChanges {
	private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
	private text = '';
	private isCollapsed = true;
	private hideToggle = true;

	@Input() maxLength = 100;
	@Input() elementChange!: HTMLElement;

	/**
	 * Angular lifecycle hook
	 */
	ngAfterViewInit(): void {
		if (!this.elementChange) return;

		this.text = this.elementChange.innerHTML ?? '';
		this.updateView();
	}

	/**
	 * Angular lifecycle hook
	 */
	ngOnChanges(): void {
		if (this.text) {
			this.updateView();
		}
	}

	/**
	 * Handle click using Angular instead of addEventListener
	 */
	@HostListener('click', ['$event'])
	onClick(event: MouseEvent): void {
		event.preventDefault();

		if (this.hideToggle) return;

		this.isCollapsed = !this.isCollapsed;
		this.updateView();
	}

	/**
	 * Update view based on collapse state
	 */
	private updateView(): void {
		if (!this.text || !this.elementChange) return;

		if (this.text.length <= this.maxLength) {
			this.elementChange.innerHTML = this.text;
			this.hideToggle = true;
			this.toggleVisibility(false);
			return;
		}

		this.hideToggle = false;

		const displayText = this.isCollapsed
			? this.text.substring(0, this.maxLength) + '...'
			: this.text;

		this.elementChange.innerHTML = displayText;

		this.toggleVisibility(true);
	}

	/**
	 * Toggle more/less buttons
	 */
	private toggleVisibility(show: boolean): void {
		const more = this.el.nativeElement.querySelector('.more');
		const less = this.el.nativeElement.querySelector('.less');

		if (!more || !less) return;

		if (!show) {
			more.setAttribute('style', 'display:none');
			less.setAttribute('style', 'display:none');
			return;
		}

		more.setAttribute('style', this.isCollapsed ? 'display:inherit' : 'display:none');
		less.setAttribute('style', this.isCollapsed ? 'display:none' : 'display:inherit');
	}
}