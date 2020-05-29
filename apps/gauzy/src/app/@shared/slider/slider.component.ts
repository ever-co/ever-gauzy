import {
	Component,
	OnInit,
	ViewChild,
	AfterViewInit,
	OnChanges,
	OnDestroy,
	HostBinding,
	HostListener,
	Input,
	ElementRef,
	Renderer2,
	EventEmitter,
	Output,
	ContentChild,
	TemplateRef,
	ChangeDetectorRef,
	SimpleChanges,
	forwardRef,
	NgZone
} from '@angular/core';

import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import {
	distinctUntilChanged,
	filter,
	throttleTime,
	tap
} from 'rxjs/operators';

import detectPassiveEvents from 'detect-passive-events';

import {
	Options,
	LabelType,
	ValueToPositionFunction,
	PositionToValueFunction,
	CustomStepDefinition
} from './options';
import { PointerType } from './pointer-type';
import { ChangeContext } from './change-context';
import { ValueHelper } from './value-helper';
import { CompatibilityHelper } from './compatibility-helper';
import { MathHelper } from './math-helper';
import { EventListener } from './event-listener';
import { EventListenerHelper } from './event-listener-helper';
import { SliderElementDirective } from './slider-element.directive';
import { SliderHandleDirective } from './slider-handle.directive';
import { SliderLabelDirective } from './slider-label.directive';

// Declaration for ResizeObserver a new API available in some of newest browsers:
// https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
declare class ResizeObserver {
	constructor(callback: () => void);
	observe(target: any): void;
	unobserve(target: any): void;
	disconnect(): void;
}

export class Tick {
	selected: boolean = false;
	style: any = {};
	tooltip: string = null;
	tooltipPlacement: string = null;
	value: string = null;
	valueTooltip: string = null;
	valueTooltipPlacement: string = null;
	legend: string = null;
}

class Dragging {
	active: boolean = false;
	value: number = 0;
	difference: number = 0;
	position: number = 0;
	lowLimit: number = 0;
	highLimit: number = 0;
}

class ModelValues {
	value: number;
	highValue: number;

	public static compare(x?: ModelValues, y?: ModelValues): boolean {
		if (
			ValueHelper.isNullOrUndefined(x) &&
			ValueHelper.isNullOrUndefined(y)
		) {
			return false;
		}
		if (
			ValueHelper.isNullOrUndefined(x) !==
			ValueHelper.isNullOrUndefined(y)
		) {
			return false;
		}
		return x.value === y.value && x.highValue === y.highValue;
	}
}

class ModelChange extends ModelValues {
	// Flag used to by-pass distinctUntilChanged() filter on input values
	// (sometimes there is a need to pass values through even though the model values have not changed)
	forceChange: boolean;

	public static compare(x?: ModelChange, y?: ModelChange): boolean {
		if (
			ValueHelper.isNullOrUndefined(x) &&
			ValueHelper.isNullOrUndefined(y)
		) {
			return false;
		}
		if (
			ValueHelper.isNullOrUndefined(x) !==
			ValueHelper.isNullOrUndefined(y)
		) {
			return false;
		}
		return (
			x.value === y.value &&
			x.highValue === y.highValue &&
			x.forceChange === y.forceChange
		);
	}
}

class InputModelChange extends ModelChange {
	internalChange: boolean;
}

class OutputModelChange extends ModelChange {
	userEventInitiated: boolean;
}

const NG5_SLIDER_CONTROL_VALUE_ACCESSOR: any = {
	provide: NG_VALUE_ACCESSOR,
	/* tslint:disable-next-line: no-use-before-declare */
	useExisting: forwardRef(() => SliderComponent),
	multi: true
};

@Component({
	selector: 'ngx-slider',
	templateUrl: './slider.component.html',
	styleUrls: ['./slider.component.scss'],
	host: { class: 'ng5-slider' },
	providers: [NG5_SLIDER_CONTROL_VALUE_ACCESSOR]
})
export class SliderComponent
	implements
		OnInit,
		AfterViewInit,
		OnChanges,
		OnDestroy,
		ControlValueAccessor {
	// Model for low value of slider. For simple slider, this is the only input. For range slider, this is the low value.
	@Input()
	public value: number = null;
	// Output for low value slider to support two-way bindings
	@Output()
	public valueChange: EventEmitter<number> = new EventEmitter();

	// Model for high value of slider. Not used in simple slider. For range slider, this is the high value.
	@Input()
	public highValue: number = null;
	// Output for high value slider to support two-way bindings
	@Output()
	public highValueChange: EventEmitter<number> = new EventEmitter();

	// An object with all the other options of the slider.
	// Each option can be updated at runtime and the slider will automatically be re-rendered.
	@Input()
	public options: Options = new Options();

	// Event emitted when user starts interaction with the slider
	@Output()
	public userChangeStart: EventEmitter<ChangeContext> = new EventEmitter();

	// Event emitted on each change coming from user interaction
	@Output()
	public userChange: EventEmitter<ChangeContext> = new EventEmitter();

	// Event emitted when user finishes interaction with the slider
	@Output()
	public userChangeEnd: EventEmitter<ChangeContext> = new EventEmitter();

	private manualRefreshSubscription: any;
	// Input event that triggers slider refresh (re-positioning of slider elements)
	@Input() set manualRefresh(manualRefresh: EventEmitter<void>) {
		this.unsubscribeManualRefresh();

		this.manualRefreshSubscription = manualRefresh.subscribe(() => {
			setTimeout(() => this.calculateViewDimensionsAndDetectChanges());
		});
	}

	private triggerFocusSubscription: any;
	// Input event that triggers setting focus on given slider handle
	@Input() set triggerFocus(triggerFocus: EventEmitter<void>) {
		this.unsubscribeTriggerFocus();

		this.triggerFocusSubscription = triggerFocus.subscribe(
			(pointerType: PointerType) => {
				this.focusPointer(pointerType);
			}
		);
	}

	// Slider type, true means range slider
	public get range(): boolean {
		return (
			!ValueHelper.isNullOrUndefined(this.value) &&
			!ValueHelper.isNullOrUndefined(this.highValue)
		);
	}

	// Set to true if init method already executed
	private initHasRun: boolean = false;

	// Changes in model inputs are passed through this subject
	// These are all changes coming in from outside the component through input bindings or reactive form inputs
	private inputModelChangeSubject: Subject<InputModelChange> = new Subject<
		InputModelChange
	>();
	private inputModelChangeSubscription: Subscription = null;

	// Changes to model outputs are passed through this subject
	// These are all changes that need to be communicated to output emitters and registered callbacks
	private outputModelChangeSubject: Subject<OutputModelChange> = new Subject<
		OutputModelChange
	>();
	private outputModelChangeSubscription: Subscription = null;

	// Low value synced to model low value
	private viewLowValue: number = null;
	// High value synced to model high value
	private viewHighValue: number = null;
	// Options synced to model options, based on defaults
	private viewOptions: Options = new Options();

	// Half of the width or height of the slider handles
	private handleHalfDimension: number = 0;
	// Maximum position the slider handle can have
	private maxHandlePosition: number = 0;

	// Which handle is currently tracked for move events
	private currentTrackingPointer: PointerType = null;
	// Internal variable to keep track of the focus element
	private currentFocusPointer: PointerType = null;
	// Used to call onStart on the first keydown event
	private firstKeyDown: boolean = false;
	// Current touch id of touch event being handled
	private touchId: number = null;
	// Values recorded when first dragging the bar
	private dragging: Dragging = new Dragging();

	/* Slider DOM elements */

	// Left selection bar outside two handles
	@ViewChild('leftOuterSelectionBar', { read: SliderElementDirective })
	private leftOuterSelectionBarElement: SliderElementDirective;

	// Right selection bar outside two handles
	@ViewChild('rightOuterSelectionBar', { read: SliderElementDirective })
	private rightOuterSelectionBarElement: SliderElementDirective;

	// The whole slider bar
	@ViewChild('fullBar', { read: SliderElementDirective })
	private fullBarElement: SliderElementDirective;

	// Highlight between two handles
	@ViewChild('selectionBar', { read: SliderElementDirective })
	private selectionBarElement: SliderElementDirective;

	// Left slider handle
	@ViewChild('minHandle', { read: SliderHandleDirective })
	private minHandleElement: SliderHandleDirective;

	// Right slider handle
	@ViewChild('maxHandle', { read: SliderHandleDirective })
	private maxHandleElement: SliderHandleDirective;

	// Floor label
	@ViewChild('floorLabel', { read: SliderLabelDirective })
	private floorLabelElement: SliderLabelDirective;

	// Ceiling label
	@ViewChild('ceilLabel', { read: SliderLabelDirective })
	private ceilLabelElement: SliderLabelDirective;

	// Label above the low value
	@ViewChild('minHandleLabel', { read: SliderLabelDirective })
	private minHandleLabelElement: SliderLabelDirective;

	// Label above the high value
	@ViewChild('maxHandleLabel', { read: SliderLabelDirective })
	private maxHandleLabelElement: SliderLabelDirective;

	// Combined label
	@ViewChild('combinedLabel', { read: SliderLabelDirective })
	private combinedLabelElement: SliderLabelDirective;

	// The ticks
	@ViewChild('ticksElement', { read: SliderElementDirective })
	private ticksElement: SliderElementDirective;

	// Optional custom template for displaying tooltips
	@ContentChild('tooltipTemplate')
	public tooltipTemplate: TemplateRef<any>;

	// Host element class bindings
	@HostBinding('class.vertical')
	public sliderElementVerticalClass: boolean = false;
	@HostBinding('class.animate')
	public sliderElementAnimateClass: boolean = false;
	@HostBinding('attr.disabled')
	public sliderElementDisabledAttr: string = null;

	// CSS styles and class flags
	public barStyle: any = {};
	public minPointerStyle: any = {};
	public maxPointerStyle: any = {};
	public fullBarTransparentClass: boolean = false;
	public selectionBarDraggableClass: boolean = false;
	public ticksUnderValuesClass: boolean = false;

	// Whether to show/hide ticks
	public get showTicks(): boolean {
		return this.viewOptions.showTicks;
	}

	/* If tickStep is set or ticksArray is specified.
     In this case, ticks values should be displayed below the slider. */
	private intermediateTicks: boolean = false;
	// Ticks array as displayed in view
	public ticks: Tick[] = [];

	// Event listeners
	private eventListenerHelper: EventListenerHelper = null;
	private onMoveEventListener: EventListener = null;
	private onEndEventListener: EventListener = null;

	// Observer for slider element resize events
	private resizeObserver: ResizeObserver = null;

	// Callbacks for reactive forms support
	private onTouchedCallback: (value: any) => void = null;
	private onChangeCallback: (value: any) => void = null;

	public constructor(
		private renderer: Renderer2,
		private elementRef: ElementRef,
		private changeDetectionRef: ChangeDetectorRef,
		private zone: NgZone
	) {
		this.eventListenerHelper = new EventListenerHelper(this.renderer);
	}

	// OnInit interface
	public ngOnInit(): void {
		this.viewOptions = new Options();
		Object.assign(this.viewOptions, this.options);

		// We need to run these two things first, before the rest of the init in ngAfterViewInit(),
		// because these two settings are set through @HostBinding and Angular change detection
		// mechanism doesn't like them changing in ngAfterViewInit()
		this.updateDisabledState();
		this.updateVerticalState();
	}

	// AfterViewInit interface
	public ngAfterViewInit(): void {
		this.applyOptions();

		this.subscribeInputModelChangeSubject(
			this.viewOptions.inputEventsInterval
		);
		this.subscribeOutputModelChangeSubject(
			this.viewOptions.outputEventsInterval
		);

		// Once we apply options, we need to normalise model values for the first time
		this.renormaliseModelValues();

		this.viewLowValue = this.modelValueToViewValue(this.value);
		if (this.range) {
			this.viewHighValue = this.modelValueToViewValue(this.highValue);
		} else {
			this.viewHighValue = null;
		}

		this.updateVerticalState(); // need to run this again to cover changes to slider elements
		this.manageElementsStyle();
		this.updateDisabledState();
		this.calculateViewDimensions();
		this.addAccessibility();
		this.updateCeilLabel();
		this.updateFloorLabel();
		this.initHandles();
		this.manageEventsBindings();

		this.subscribeResizeObserver();

		this.initHasRun = true;

		// Run change detection manually to resolve some issues when init procedure changes values used in the view
		this.changeDetectionRef.detectChanges();
	}

	// OnChanges interface
	public ngOnChanges(changes: SimpleChanges): void {
		// Always apply options first
		if (!ValueHelper.isNullOrUndefined(changes.options)) {
			this.onChangeOptions();
		}

		// Then value changes
		if (
			!ValueHelper.isNullOrUndefined(changes.value) ||
			!ValueHelper.isNullOrUndefined(changes.highValue)
		) {
			this.inputModelChangeSubject.next({
				value: this.value,
				highValue: this.highValue,
				forceChange: false,
				internalChange: false
			});
		}
	}

	// OnDestroy interface
	public ngOnDestroy(): void {
		this.unbindEvents();

		this.unsubscribeResizeObserver();
		this.unsubscribeInputModelChangeSubject();
		this.unsubscribeOutputModelChangeSubject();
		this.unsubscribeManualRefresh();
		this.unsubscribeTriggerFocus();
	}

	// ControlValueAccessor interface
	public writeValue(obj: any): void {
		if (obj instanceof Array) {
			this.value = obj[0];
			this.highValue = obj[1];
		} else {
			this.value = obj;
		}

		// ngOnChanges() is not called in this instance, so we need to communicate the change manually
		this.inputModelChangeSubject.next({
			value: this.value,
			highValue: this.highValue,
			forceChange: false,
			internalChange: false
		});
	}

	// ControlValueAccessor interface
	public registerOnChange(onChangeCallback: any): void {
		this.onChangeCallback = onChangeCallback;
	}

	// ControlValueAccessor interface
	public registerOnTouched(onTouchedCallback: any): void {
		this.onTouchedCallback = onTouchedCallback;
	}

	// ControlValueAccessor interface
	public setDisabledState(isDisabled: boolean): void {
		this.viewOptions.disabled = isDisabled;
		this.updateDisabledState();
	}

	@HostListener('window:resize', ['$event'])
	public onResize(event: any): void {
		this.calculateViewDimensionsAndDetectChanges();
	}

	private subscribeInputModelChangeSubject(interval?: number): void {
		this.inputModelChangeSubscription = this.inputModelChangeSubject
			.pipe(
				distinctUntilChanged(ModelChange.compare),
				// Hack to reset the status of the distinctUntilChanged() - if a "fake" event comes through with forceChange=true,
				// we forcefully by-pass distinctUntilChanged(), but otherwise drop the event
				filter(
					(modelChange: InputModelChange) =>
						!modelChange.forceChange && !modelChange.internalChange
				),
				!ValueHelper.isNullOrUndefined(interval)
					? throttleTime(interval, undefined, {
							leading: true,
							trailing: true
					  })
					: tap(() => {}) // no-op
			)
			.subscribe((modelChange: InputModelChange) =>
				this.applyInputModelChange(modelChange)
			);
	}

	private subscribeOutputModelChangeSubject(interval?: number): void {
		this.outputModelChangeSubscription = this.outputModelChangeSubject
			.pipe(
				distinctUntilChanged(ModelChange.compare),
				!ValueHelper.isNullOrUndefined(interval)
					? throttleTime(interval, undefined, {
							leading: true,
							trailing: true
					  })
					: tap(() => {}) // no-op
			)
			.subscribe((modelChange: OutputModelChange) =>
				this.publishOutputModelChange(modelChange)
			);
	}

	private subscribeResizeObserver(): void {
		if (CompatibilityHelper.isResizeObserverAvailable()) {
			this.resizeObserver = new ResizeObserver((): void =>
				this.calculateViewDimensionsAndDetectChanges()
			);
			this.resizeObserver.observe(this.elementRef.nativeElement);
		}
	}

	private unsubscribeResizeObserver(): void {
		if (
			CompatibilityHelper.isResizeObserverAvailable() &&
			this.resizeObserver !== null
		) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	private unsubscribeOnMove(): void {
		if (!ValueHelper.isNullOrUndefined(this.onMoveEventListener)) {
			this.eventListenerHelper.detachEventListener(
				this.onMoveEventListener
			);
			this.onMoveEventListener = null;
		}
	}

	private unsubscribeOnEnd(): void {
		if (!ValueHelper.isNullOrUndefined(this.onEndEventListener)) {
			this.eventListenerHelper.detachEventListener(
				this.onEndEventListener
			);
			this.onEndEventListener = null;
		}
	}

	private unsubscribeInputModelChangeSubject(): void {
		if (!ValueHelper.isNullOrUndefined(this.inputModelChangeSubscription)) {
			this.inputModelChangeSubscription.unsubscribe();
			this.inputModelChangeSubscription = null;
		}
	}

	private unsubscribeOutputModelChangeSubject(): void {
		if (
			!ValueHelper.isNullOrUndefined(this.outputModelChangeSubscription)
		) {
			this.outputModelChangeSubscription.unsubscribe();
			this.outputModelChangeSubscription = null;
		}
	}

	private unsubscribeManualRefresh(): void {
		if (!ValueHelper.isNullOrUndefined(this.manualRefreshSubscription)) {
			this.manualRefreshSubscription.unsubscribe();
			this.manualRefreshSubscription = null;
		}
	}

	private unsubscribeTriggerFocus(): void {
		if (!ValueHelper.isNullOrUndefined(this.triggerFocusSubscription)) {
			this.triggerFocusSubscription.unsubscribe();
			this.triggerFocusSubscription = null;
		}
	}

	private getPointerElement(pointerType: PointerType): SliderHandleDirective {
		if (pointerType === PointerType.Min) {
			return this.minHandleElement;
		} else if (pointerType === PointerType.Max) {
			return this.maxHandleElement;
		}
		return null;
	}

	private getCurrentTrackingValue(): number {
		if (this.currentTrackingPointer === PointerType.Min) {
			return this.viewLowValue;
		} else if (this.currentTrackingPointer === PointerType.Max) {
			return this.viewHighValue;
		}
		return null;
	}

	private modelValueToViewValue(modelValue: number): number {
		if (ValueHelper.isNullOrUndefined(modelValue)) {
			return NaN;
		}

		if (
			!ValueHelper.isNullOrUndefined(this.viewOptions.stepsArray) &&
			!this.viewOptions.bindIndexForStepsArray
		) {
			return ValueHelper.findStepIndex(
				+modelValue,
				this.viewOptions.stepsArray
			);
		}
		return +modelValue;
	}

	private viewValueToModelValue(viewValue: number): number {
		if (
			!ValueHelper.isNullOrUndefined(this.viewOptions.stepsArray) &&
			!this.viewOptions.bindIndexForStepsArray
		) {
			return this.getStepValue(viewValue);
		}
		return viewValue;
	}

	private getStepValue(sliderValue: number): number {
		const step: CustomStepDefinition = this.viewOptions.stepsArray[
			sliderValue
		];
		return !ValueHelper.isNullOrUndefined(step) ? step.value : NaN;
	}

	private applyViewChange(): void {
		this.value = this.viewValueToModelValue(this.viewLowValue);
		if (this.range) {
			this.highValue = this.viewValueToModelValue(this.viewHighValue);
		}

		this.outputModelChangeSubject.next({
			value: this.value,
			highValue: this.highValue,
			userEventInitiated: true,
			forceChange: false
		});

		// At this point all changes are applied and outputs are emitted, so we should be done.
		// However, input changes are communicated in different stream and we need to be ready to
		// act on the next input change even if it is exactly the same as last input change.
		// Therefore, we send a special event to reset the stream.
		this.inputModelChangeSubject.next({
			value: this.value,
			highValue: this.highValue,
			forceChange: false,
			internalChange: true
		});
	}

	// Apply model change to the slider view
	private applyInputModelChange(modelChange: InputModelChange): void {
		const normalisedModelChange: ModelValues = this.normaliseModelValues(
			modelChange
		);

		// If normalised model change is different, apply the change to the model values
		const normalisationChange: boolean = !ModelValues.compare(
			modelChange,
			normalisedModelChange
		);
		if (normalisationChange) {
			this.value = normalisedModelChange.value;
			this.highValue = normalisedModelChange.highValue;
		}

		this.viewLowValue = this.modelValueToViewValue(
			normalisedModelChange.value
		);
		if (this.range) {
			this.viewHighValue = this.modelValueToViewValue(
				normalisedModelChange.highValue
			);
		} else {
			this.viewHighValue = null;
		}

		this.updateLowHandle(this.valueToPosition(this.viewLowValue));
		if (this.range) {
			this.updateHighHandle(this.valueToPosition(this.viewHighValue));
		}
		this.updateSelectionBar();
		this.updateTicksScale();
		this.updateAriaAttributes();
		if (this.range) {
			this.updateCombinedLabel();
		}

		// At the end, we need to communicate the model change to the outputs as well
		// Normalisation changes are also always forced out to ensure that subscribers always end up in correct state
		this.outputModelChangeSubject.next({
			value: normalisedModelChange.value,
			highValue: normalisedModelChange.highValue,
			forceChange: normalisationChange,
			userEventInitiated: false
		});
	}

	// Publish model change to output event emitters and registered callbacks
	private publishOutputModelChange(modelChange: OutputModelChange): void {
		const emitOutputs: () => void = (): void => {
			this.valueChange.emit(modelChange.value);
			if (this.range) {
				this.highValueChange.emit(modelChange.highValue);
			}

			if (!ValueHelper.isNullOrUndefined(this.onChangeCallback)) {
				if (this.range) {
					this.onChangeCallback([
						modelChange.value,
						modelChange.highValue
					]);
				} else {
					this.onChangeCallback(modelChange.value);
				}
			}
			if (!ValueHelper.isNullOrUndefined(this.onTouchedCallback)) {
				if (this.range) {
					this.onTouchedCallback([
						modelChange.value,
						modelChange.highValue
					]);
				} else {
					this.onTouchedCallback(modelChange.value);
				}
			}
		};

		if (modelChange.userEventInitiated) {
			// If this change was initiated by a user event, we can emit outputs in the same tick
			emitOutputs();
			this.userChange.emit(this.getChangeContext());
		} else {
			// But, if the change was initated by something else like a change in input bindings,
			// we need to wait until next tick to emit the outputs to keep Angular change detection happy
			setTimeout(() => {
				emitOutputs();
			});
		}
	}

	private normaliseModelValues(input: ModelValues): ModelValues {
		const normalisedInput: ModelValues = new ModelValues();
		normalisedInput.value = input.value;
		normalisedInput.highValue = input.highValue;

		if (this.viewOptions.enforceStep) {
			normalisedInput.value = this.roundStep(normalisedInput.value);
			if (this.range) {
				normalisedInput.highValue = this.roundStep(
					normalisedInput.highValue
				);
			}
		}

		// Don't attempt to normalise further when using steps array (steps may be out of order and that is perfectly fine)
		if (
			!ValueHelper.isNullOrUndefined(this.viewOptions.stepsArray) ||
			!this.viewOptions.enforceRange
		) {
			return normalisedInput;
		}

		normalisedInput.value = MathHelper.clampToRange(
			normalisedInput.value,
			this.viewOptions.floor,
			this.viewOptions.ceil
		);

		if (this.range) {
			normalisedInput.highValue = MathHelper.clampToRange(
				normalisedInput.highValue,
				this.viewOptions.floor,
				this.viewOptions.ceil
			);
		}

		// Make sure that range slider invariant (value <= highValue) is always satisfied
		if (this.range && input.value > input.highValue) {
			// We know that both values are now clamped correctly, they may just be in the wrong order
			// So the easy solution is to swap them... except swapping is sometimes disabled in options, so we make the two values the same
			if (this.viewOptions.noSwitching) {
				normalisedInput.value = normalisedInput.highValue;
			} else {
				const tempValue: number = input.value;
				normalisedInput.value = input.highValue;
				normalisedInput.highValue = tempValue;
			}
		}

		return normalisedInput;
	}

	private renormaliseModelValues(): void {
		const previousModelValues: ModelValues = {
			value: this.value,
			highValue: this.highValue
		};
		const normalisedModelValues: ModelValues = this.normaliseModelValues(
			previousModelValues
		);
		if (!ModelValues.compare(normalisedModelValues, previousModelValues)) {
			this.value = normalisedModelValues.value;
			this.highValue = normalisedModelValues.highValue;

			this.outputModelChangeSubject.next({
				value: this.value,
				highValue: this.highValue,
				forceChange: true,
				userEventInitiated: false
			});
		}
	}

	private onChangeOptions(): void {
		if (!this.initHasRun) {
			return;
		}

		const previousInputEventsInterval: number = this.viewOptions
			.inputEventsInterval;
		const previousOutputEventsInterval: number = this.viewOptions
			.outputEventsInterval;

		this.applyOptions();

		if (
			previousInputEventsInterval !== this.viewOptions.inputEventsInterval
		) {
			this.unsubscribeInputModelChangeSubject();
			this.subscribeInputModelChangeSubject(
				this.viewOptions.inputEventsInterval
			);
		}

		if (
			previousOutputEventsInterval !==
			this.viewOptions.outputEventsInterval
		) {
			this.unsubscribeInputModelChangeSubject();
			this.subscribeInputModelChangeSubject(
				this.viewOptions.outputEventsInterval
			);
		}

		// With new options, we need to re-normalise model values if necessary
		this.renormaliseModelValues();

		this.viewLowValue = this.modelValueToViewValue(this.value);
		if (this.range) {
			this.viewHighValue = this.modelValueToViewValue(this.highValue);
		} else {
			this.viewHighValue = null;
		}

		this.resetSlider();
	}

	// Read the user options and apply them to the slider model
	private applyOptions(): void {
		this.viewOptions = new Options();
		Object.assign(this.viewOptions, this.options);

		this.viewOptions.draggableRange =
			this.range && this.viewOptions.draggableRange;
		this.viewOptions.draggableRangeOnly =
			this.range && this.viewOptions.draggableRangeOnly;
		if (this.viewOptions.draggableRangeOnly) {
			this.viewOptions.draggableRange = true;
		}

		this.viewOptions.showTicks =
			this.viewOptions.showTicks ||
			this.viewOptions.showTicksValues ||
			!ValueHelper.isNullOrUndefined(this.viewOptions.ticksArray);
		if (
			this.viewOptions.showTicks &&
			(!ValueHelper.isNullOrUndefined(this.viewOptions.tickStep) ||
				!ValueHelper.isNullOrUndefined(this.viewOptions.ticksArray))
		) {
			this.intermediateTicks = true;
		}

		this.viewOptions.showSelectionBar =
			this.viewOptions.showSelectionBar ||
			this.viewOptions.showSelectionBarEnd ||
			!ValueHelper.isNullOrUndefined(
				this.viewOptions.showSelectionBarFromValue
			);

		if (!ValueHelper.isNullOrUndefined(this.viewOptions.stepsArray)) {
			this.applyStepsArrayOptions();
		} else {
			this.applyFloorCeilOptions();
		}

		if (ValueHelper.isNullOrUndefined(this.viewOptions.combineLabels)) {
			this.viewOptions.combineLabels = (
				minValue: string,
				maxValue: string
			): string => {
				return minValue + ' - ' + maxValue;
			};
		}

		if (this.viewOptions.logScale && this.viewOptions.floor === 0) {
			throw Error("Can't use floor=0 with logarithmic scale");
		}
	}

	private applyStepsArrayOptions(): void {
		this.viewOptions.floor = 0;
		this.viewOptions.ceil = this.viewOptions.stepsArray.length - 1;
		this.viewOptions.step = 1;

		if (ValueHelper.isNullOrUndefined(this.viewOptions.translate)) {
			this.viewOptions.translate = (modelValue: number): string => {
				if (this.viewOptions.bindIndexForStepsArray) {
					return String(this.getStepValue(modelValue));
				}
				return String(modelValue);
			};
		}

		this.viewOptions.getLegend = (index: number): string => {
			const step: CustomStepDefinition = this.viewOptions.stepsArray[
				index
			];
			return step.legend;
		};
	}

	private applyFloorCeilOptions(): void {
		if (ValueHelper.isNullOrUndefined(this.viewOptions.step)) {
			this.viewOptions.step = 1;
		} else {
			this.viewOptions.step = +this.viewOptions.step;
			if (this.viewOptions.step <= 0) {
				this.viewOptions.step = 1;
			}
		}

		if (
			ValueHelper.isNullOrUndefined(this.viewOptions.ceil) ||
			ValueHelper.isNullOrUndefined(this.viewOptions.floor)
		) {
			throw Error('floor and ceil options must be supplied');
		}
		this.viewOptions.ceil = +this.viewOptions.ceil;
		this.viewOptions.floor = +this.viewOptions.floor;

		if (ValueHelper.isNullOrUndefined(this.viewOptions.translate)) {
			this.viewOptions.translate = (value: number): string =>
				String(value);
		}
	}

	// Resets slider
	private resetSlider(): void {
		this.manageElementsStyle();
		this.addAccessibility();
		this.updateCeilLabel();
		this.updateFloorLabel();
		this.unbindEvents();
		this.manageEventsBindings();
		this.updateDisabledState();
		this.calculateViewDimensions();
		this.refocusPointerIfNeeded();
	}

	// Sets focus on the specified pointer
	private focusPointer(pointerType: PointerType): void {
		// If not supplied, use min pointer as default
		if (
			pointerType !== PointerType.Min &&
			pointerType !== PointerType.Max
		) {
			pointerType = PointerType.Min;
		}

		if (pointerType === PointerType.Min) {
			this.minHandleElement.focus();
		} else if (this.range && pointerType === PointerType.Max) {
			this.maxHandleElement.focus();
		}
	}

	private refocusPointerIfNeeded(): void {
		if (!ValueHelper.isNullOrUndefined(this.currentFocusPointer)) {
			this.onPointerFocus(this.currentFocusPointer);
			const element: SliderHandleDirective = this.getPointerElement(
				this.currentFocusPointer
			);
			element.focus();
		}
	}

	// Update each elements style based on options
	private manageElementsStyle(): void {
		this.updateScale();

		this.floorLabelElement.setAlwaysHide(
			this.viewOptions.showTicksValues || this.viewOptions.hideLimitLabels
		);
		this.ceilLabelElement.setAlwaysHide(
			this.viewOptions.showTicksValues || this.viewOptions.hideLimitLabels
		);

		const hideLabelsForTicks: boolean =
			this.viewOptions.showTicksValues && !this.intermediateTicks;
		this.minHandleLabelElement.setAlwaysHide(
			hideLabelsForTicks || this.viewOptions.hidePointerLabels
		);
		this.maxHandleLabelElement.setAlwaysHide(
			hideLabelsForTicks ||
				!this.range ||
				this.viewOptions.hidePointerLabels
		);
		this.combinedLabelElement.setAlwaysHide(
			hideLabelsForTicks ||
				!this.range ||
				this.viewOptions.hidePointerLabels
		);
		this.selectionBarElement.setAlwaysHide(
			!this.range && !this.viewOptions.showSelectionBar
		);
		this.leftOuterSelectionBarElement.setAlwaysHide(
			!this.range || !this.viewOptions.showOuterSelectionBars
		);
		this.rightOuterSelectionBarElement.setAlwaysHide(
			!this.range || !this.viewOptions.showOuterSelectionBars
		);

		this.fullBarTransparentClass =
			this.range && this.viewOptions.showOuterSelectionBars;
		this.selectionBarDraggableClass =
			this.viewOptions.draggableRange &&
			!this.viewOptions.onlyBindHandles;
		this.ticksUnderValuesClass =
			this.intermediateTicks && this.options.showTicksValues;

		if (this.sliderElementVerticalClass !== this.viewOptions.vertical) {
			this.updateVerticalState();
			// The above change in host component class will not be applied until the end of this cycle
			// However, functions calculating the slider position expect the slider to be already styled as vertical
			// So as a workaround, we need to reset the slider once again to compute the correct values
			setTimeout((): void => {
				this.resetSlider();
			});
		}

		// Changing animate class may interfere with slider reset/initialisation, so we should set it separately,
		// after all is properly set up
		if (this.sliderElementAnimateClass !== this.viewOptions.animate) {
			setTimeout((): void => {
				this.sliderElementAnimateClass = this.viewOptions.animate;
			});
		}
	}

	// Manage the events bindings based on readOnly and disabled options
	private manageEventsBindings(): void {
		if (this.viewOptions.disabled || this.viewOptions.readOnly) {
			this.unbindEvents();
		} else {
			this.bindEvents();
		}
	}

	// Set the disabled state based on disabled option
	private updateDisabledState(): void {
		this.sliderElementDisabledAttr = this.viewOptions.disabled
			? 'disabled'
			: null;
	}

	// Set vertical state based on vertical option
	private updateVerticalState(): void {
		this.sliderElementVerticalClass = this.viewOptions.vertical;
		for (const element of this.getAllSliderElements()) {
			// This is also called before ngAfterInit, so need to check that view child bindings work
			if (!ValueHelper.isNullOrUndefined(element)) {
				element.setVertical(this.viewOptions.vertical);
			}
		}
	}

	private updateScale(): void {
		for (const element of this.getAllSliderElements()) {
			element.setScale(this.viewOptions.scale);
		}
	}

	private getAllSliderElements(): SliderElementDirective[] {
		return [
			this.leftOuterSelectionBarElement,
			this.rightOuterSelectionBarElement,
			this.fullBarElement,
			this.selectionBarElement,
			this.minHandleElement,
			this.maxHandleElement,
			this.floorLabelElement,
			this.ceilLabelElement,
			this.minHandleLabelElement,
			this.maxHandleLabelElement,
			this.combinedLabelElement,
			this.ticksElement
		];
	}

	// Initialize slider handles positions and labels
	// Run only once during initialization and every time view port changes size
	private initHandles(): void {
		this.updateLowHandle(this.valueToPosition(this.viewLowValue));

		/*
   the order here is important since the selection bar should be
   updated after the high handle but before the combined label
   */
		if (this.range) {
			this.updateHighHandle(this.valueToPosition(this.viewHighValue));
		}

		this.updateSelectionBar();

		if (this.range) {
			this.updateCombinedLabel();
		}

		this.updateTicksScale();
	}

	// Adds accessibility attributes, run only once during initialization
	private addAccessibility(): void {
		this.updateAriaAttributes();

		this.minHandleElement.role = 'slider';

		if (
			this.viewOptions.keyboardSupport &&
			!(this.viewOptions.readOnly || this.viewOptions.disabled)
		) {
			this.minHandleElement.tabindex = '0';
		} else {
			this.minHandleElement.tabindex = '';
		}

		if (this.viewOptions.vertical) {
			this.minHandleElement.ariaOrientation = 'vertical';
		}

		if (!ValueHelper.isNullOrUndefined(this.viewOptions.ariaLabel)) {
			this.minHandleElement.ariaLabel = this.viewOptions.ariaLabel;
		} else if (
			!ValueHelper.isNullOrUndefined(this.viewOptions.ariaLabelledBy)
		) {
			this.minHandleElement.ariaLabelledBy = this.viewOptions.ariaLabelledBy;
		}

		if (this.range) {
			this.maxHandleElement.role = 'slider';

			if (
				this.viewOptions.keyboardSupport &&
				!(this.viewOptions.readOnly || this.viewOptions.disabled)
			) {
				this.maxHandleElement.tabindex = '0';
			} else {
				this.maxHandleElement.tabindex = '';
			}

			this.maxHandleElement.ariaOrientation = this.viewOptions.vertical
				? 'vertical'
				: 'horizontal';

			if (
				!ValueHelper.isNullOrUndefined(this.viewOptions.ariaLabelHigh)
			) {
				this.maxHandleElement.ariaLabel = this.viewOptions.ariaLabelHigh;
			} else if (
				!ValueHelper.isNullOrUndefined(
					this.viewOptions.ariaLabelledByHigh
				)
			) {
				this.maxHandleElement.ariaLabelledBy = this.viewOptions.ariaLabelledByHigh;
			}
		}
	}

	// Updates aria attributes according to current values
	private updateAriaAttributes(): void {
		this.minHandleElement.ariaValueNow = (+this.value).toString();
		this.minHandleElement.ariaValueText = this.viewOptions.translate(
			+this.value,
			LabelType.Low
		);
		this.minHandleElement.ariaValueMin = this.viewOptions.floor.toString();
		this.minHandleElement.ariaValueMax = this.viewOptions.ceil.toString();

		if (this.range) {
			this.maxHandleElement.ariaValueNow = (+this.highValue).toString();
			this.maxHandleElement.ariaValueText = this.viewOptions.translate(
				+this.highValue,
				LabelType.High
			);
			this.maxHandleElement.ariaValueMin = this.viewOptions.floor.toString();
			this.maxHandleElement.ariaValueMax = this.viewOptions.ceil.toString();
		}
	}

	// Calculate dimensions that are dependent on view port size
	// Run once during initialization and every time view port changes size.
	private calculateViewDimensions(): void {
		if (!ValueHelper.isNullOrUndefined(this.viewOptions.handleDimension)) {
			this.minHandleElement.setDimension(
				this.viewOptions.handleDimension
			);
		} else {
			this.minHandleElement.calculateDimension();
		}

		const handleWidth: number = this.minHandleElement.dimension;

		this.handleHalfDimension = handleWidth / 2;

		if (!ValueHelper.isNullOrUndefined(this.viewOptions.barDimension)) {
			this.fullBarElement.setDimension(this.viewOptions.barDimension);
		} else {
			this.fullBarElement.calculateDimension();
		}

		this.maxHandlePosition = this.fullBarElement.dimension - handleWidth;

		if (this.initHasRun) {
			this.updateFloorLabel();
			this.updateCeilLabel();
			this.initHandles();
		}
	}

	private calculateViewDimensionsAndDetectChanges(): void {
		this.calculateViewDimensions();
		this.changeDetectionRef.detectChanges();
	}

	// Update the ticks position
	private updateTicksScale(): void {
		if (!this.viewOptions.showTicks) {
			return;
		}

		const ticksArray: number[] = !ValueHelper.isNullOrUndefined(
			this.viewOptions.ticksArray
		)
			? this.viewOptions.ticksArray
			: this.getTicksArray();
		const translate: string = this.viewOptions.vertical
			? 'translateY'
			: 'translateX';

		if (this.viewOptions.rightToLeft) {
			ticksArray.reverse();
		}

		const newTicks: Tick[] = ticksArray.map(
			(value: number): Tick => {
				let position: number = this.valueToPosition(value);

				if (this.viewOptions.vertical) {
					position = this.maxHandlePosition - position;
				}

				const translation: string =
					translate + '(' + Math.round(position) + 'px)';
				const tick: Tick = new Tick();
				tick.selected = this.isTickSelected(value);
				tick.style = {
					'-webkit-transform': translation,
					'-moz-transform': translation,
					'-o-transform': translation,
					'-ms-transform': translation,
					transform: translation
				};
				if (
					tick.selected &&
					!ValueHelper.isNullOrUndefined(
						this.viewOptions.getSelectionBarColor
					)
				) {
					tick.style[
						'background-color'
					] = this.getSelectionBarColor();
				}
				if (
					!tick.selected &&
					!ValueHelper.isNullOrUndefined(
						this.viewOptions.getTickColor
					)
				) {
					tick.style['background-color'] = this.getTickColor(value);
				}
				if (
					!ValueHelper.isNullOrUndefined(
						this.viewOptions.ticksTooltip
					)
				) {
					tick.tooltip = this.viewOptions.ticksTooltip(value);
					tick.tooltipPlacement = this.viewOptions.vertical
						? 'right'
						: 'top';
				}
				if (
					this.viewOptions.showTicksValues &&
					value % this.viewOptions.tickValueStep === 0
				) {
					tick.value = this.getDisplayValue(
						value,
						LabelType.TickValue
					);
					if (
						!ValueHelper.isNullOrUndefined(
							this.viewOptions.ticksValuesTooltip
						)
					) {
						tick.valueTooltip = this.viewOptions.ticksValuesTooltip(
							value
						);
						tick.valueTooltipPlacement = this.viewOptions.vertical
							? 'right'
							: 'top';
					}
				}
				if (
					!ValueHelper.isNullOrUndefined(this.viewOptions.getLegend)
				) {
					const legend: string = this.viewOptions.getLegend(value);
					if (!ValueHelper.isNullOrUndefined(legend)) {
						tick.legend = legend;
					}
				}
				return tick;
			}
		);

		// We should avoid re-creating the ticks array if possible
		// This both improves performance and makes CSS animations work correctly
		if (
			!ValueHelper.isNullOrUndefined(this.ticks) &&
			this.ticks.length === newTicks.length
		) {
			for (let i: number = 0; i < newTicks.length; ++i) {
				Object.assign(this.ticks[i], newTicks[i]);
			}
		} else {
			this.ticks = newTicks;
		}

		this.changeDetectionRef.detectChanges();
	}

	private getTicksArray(): number[] {
		const step: number = !ValueHelper.isNullOrUndefined(
			this.viewOptions.tickStep
		)
			? this.viewOptions.tickStep
			: this.viewOptions.step;
		const ticksArray: number[] = [];
		for (
			let value: number = this.viewOptions.floor;
			value <= this.viewOptions.ceil;
			value += step
		) {
			ticksArray.push(value);
		}
		return ticksArray;
	}

	private isTickSelected(value: number): boolean {
		if (!this.range) {
			if (
				!ValueHelper.isNullOrUndefined(
					this.viewOptions.showSelectionBarFromValue
				)
			) {
				const center: number = this.viewOptions
					.showSelectionBarFromValue;
				if (
					this.viewLowValue > center &&
					value >= center &&
					value <= this.viewLowValue
				) {
					return true;
				} else if (
					this.viewLowValue < center &&
					value <= center &&
					value >= this.viewLowValue
				) {
					return true;
				}
			} else if (this.viewOptions.showSelectionBarEnd) {
				if (value >= this.viewLowValue) {
					return true;
				}
			} else if (
				this.viewOptions.showSelectionBar &&
				value <= this.viewLowValue
			) {
				return true;
			}
		}

		if (
			this.range &&
			value >= this.viewLowValue &&
			value <= this.viewHighValue
		) {
			return true;
		}

		return false;
	}

	// Update position of the floor label
	private updateFloorLabel(): void {
		if (!this.floorLabelElement.alwaysHide) {
			this.floorLabelElement.setValue(
				this.getDisplayValue(this.viewOptions.floor, LabelType.Floor)
			);
			this.floorLabelElement.calculateDimension();
			const position: number = this.viewOptions.rightToLeft
				? this.fullBarElement.dimension -
				  this.floorLabelElement.dimension
				: 0;
			this.floorLabelElement.setPosition(position);
		}
	}

	// Update position of the ceiling label
	private updateCeilLabel(): void {
		if (!this.ceilLabelElement.alwaysHide) {
			this.ceilLabelElement.setValue(
				this.getDisplayValue(this.viewOptions.ceil, LabelType.Ceil)
			);
			this.ceilLabelElement.calculateDimension();
			const position: number = this.viewOptions.rightToLeft
				? 0
				: this.fullBarElement.dimension -
				  this.ceilLabelElement.dimension;
			this.ceilLabelElement.setPosition(position);
		}
	}

	// Update slider handles and label positions
	private updateHandles(which: PointerType, newPos: number): void {
		if (which === PointerType.Min) {
			this.updateLowHandle(newPos);
		} else if (which === PointerType.Max) {
			this.updateHighHandle(newPos);
		}

		this.updateSelectionBar();
		this.updateTicksScale();
		if (this.range) {
			this.updateCombinedLabel();
		}
	}

	// Helper function to work out the position for handle labels depending on RTL or not
	private getHandleLabelPos(labelType: PointerType, newPos: number): number {
		const labelDimension: number =
			labelType === PointerType.Min
				? this.minHandleLabelElement.dimension
				: this.maxHandleLabelElement.dimension;
		const nearHandlePos: number =
			newPos - labelDimension / 2 + this.handleHalfDimension;
		const endOfBarPos: number =
			this.fullBarElement.dimension - labelDimension;

		if (!this.viewOptions.boundPointerLabels) {
			return nearHandlePos;
		}

		if (
			(this.viewOptions.rightToLeft && labelType === PointerType.Min) ||
			(!this.viewOptions.rightToLeft && labelType === PointerType.Max)
		) {
			return Math.min(nearHandlePos, endOfBarPos);
		} else {
			return Math.min(Math.max(nearHandlePos, 0), endOfBarPos);
		}
	}

	// Update low slider handle position and label
	private updateLowHandle(newPos: number): void {
		this.minHandleElement.setPosition(newPos);
		this.minHandleLabelElement.setValue(
			this.getDisplayValue(this.viewLowValue, LabelType.Low)
		);
		this.minHandleLabelElement.setPosition(
			this.getHandleLabelPos(PointerType.Min, newPos)
		);

		if (!ValueHelper.isNullOrUndefined(this.viewOptions.getPointerColor)) {
			this.minPointerStyle = {
				backgroundColor: this.getPointerColor(PointerType.Min)
			};
		}

		if (this.viewOptions.autoHideLimitLabels) {
			this.updateFloorAndCeilLabelsVisibility();
		}
	}

	// Update high slider handle position and label
	private updateHighHandle(newPos: number): void {
		this.maxHandleElement.setPosition(newPos);
		this.maxHandleLabelElement.setValue(
			this.getDisplayValue(this.viewHighValue, LabelType.High)
		);
		this.maxHandleLabelElement.setPosition(
			this.getHandleLabelPos(PointerType.Max, newPos)
		);

		if (!ValueHelper.isNullOrUndefined(this.viewOptions.getPointerColor)) {
			this.maxPointerStyle = {
				backgroundColor: this.getPointerColor(PointerType.Max)
			};
		}
		if (this.viewOptions.autoHideLimitLabels) {
			this.updateFloorAndCeilLabelsVisibility();
		}
	}

	// Show/hide floor/ceiling label
	private updateFloorAndCeilLabelsVisibility(): void {
		// Show based only on hideLimitLabels if pointer labels are hidden
		if (this.viewOptions.hidePointerLabels) {
			return;
		}
		let floorLabelHidden: boolean = false;
		let ceilLabelHidden: boolean = false;
		const isMinLabelAtFloor: boolean = this.isLabelBelowFloorLabel(
			this.minHandleLabelElement
		);
		const isMinLabelAtCeil: boolean = this.isLabelAboveCeilLabel(
			this.minHandleLabelElement
		);
		const isMaxLabelAtCeil: boolean = this.isLabelAboveCeilLabel(
			this.maxHandleLabelElement
		);
		const isCombinedLabelAtFloor: boolean = this.isLabelBelowFloorLabel(
			this.combinedLabelElement
		);
		const isCombinedLabelAtCeil: boolean = this.isLabelAboveCeilLabel(
			this.combinedLabelElement
		);

		if (isMinLabelAtFloor) {
			floorLabelHidden = true;
			this.floorLabelElement.hide();
		} else {
			floorLabelHidden = false;
			this.floorLabelElement.show();
		}

		if (isMinLabelAtCeil) {
			ceilLabelHidden = true;
			this.ceilLabelElement.hide();
		} else {
			ceilLabelHidden = false;
			this.ceilLabelElement.show();
		}

		if (this.range) {
			const hideCeil: boolean = this.combinedLabelElement.isVisible()
				? isCombinedLabelAtCeil
				: isMaxLabelAtCeil;
			const hideFloor: boolean = this.combinedLabelElement.isVisible()
				? isCombinedLabelAtFloor
				: isMinLabelAtFloor;

			if (hideCeil) {
				this.ceilLabelElement.hide();
			} else if (!ceilLabelHidden) {
				this.ceilLabelElement.show();
			}

			// Hide or show floor label
			if (hideFloor) {
				this.floorLabelElement.hide();
			} else if (!floorLabelHidden) {
				this.floorLabelElement.show();
			}
		}
	}

	private isLabelBelowFloorLabel(label: SliderLabelDirective): boolean {
		const pos: number = label.position;
		const dim: number = label.dimension;
		const floorPos: number = this.floorLabelElement.position;
		const floorDim: number = this.floorLabelElement.dimension;
		return this.viewOptions.rightToLeft
			? pos + dim >= floorPos - 2
			: pos <= floorPos + floorDim + 2;
	}

	private isLabelAboveCeilLabel(label: SliderLabelDirective): boolean {
		const pos: number = label.position;
		const dim: number = label.dimension;
		const ceilPos: number = this.ceilLabelElement.position;
		const ceilDim: number = this.ceilLabelElement.dimension;
		return this.viewOptions.rightToLeft
			? pos <= ceilPos + ceilDim + 2
			: pos + dim >= ceilPos - 2;
	}

	// Update slider selection bar, combined label and range label
	private updateSelectionBar(): void {
		let position: number = 0;
		let dimension: number = 0;
		const isSelectionBarFromRight: boolean = this.viewOptions.rightToLeft
			? !this.viewOptions.showSelectionBarEnd
			: this.viewOptions.showSelectionBarEnd;
		const positionForRange: number = this.viewOptions.rightToLeft
			? this.maxHandleElement.position + this.handleHalfDimension
			: this.minHandleElement.position + this.handleHalfDimension;

		if (this.range) {
			dimension = Math.abs(
				this.maxHandleElement.position - this.minHandleElement.position
			);
			position = positionForRange;
		} else {
			if (
				!ValueHelper.isNullOrUndefined(
					this.viewOptions.showSelectionBarFromValue
				)
			) {
				const center: number = this.viewOptions
					.showSelectionBarFromValue;
				const centerPosition: number = this.valueToPosition(center);
				const isModelGreaterThanCenter: boolean = this.viewOptions
					.rightToLeft
					? this.viewLowValue <= center
					: this.viewLowValue > center;
				if (isModelGreaterThanCenter) {
					dimension = this.minHandleElement.position - centerPosition;
					position = centerPosition + this.handleHalfDimension;
				} else {
					dimension = centerPosition - this.minHandleElement.position;
					position =
						this.minHandleElement.position +
						this.handleHalfDimension;
				}
			} else if (isSelectionBarFromRight) {
				dimension = Math.ceil(
					Math.abs(
						this.maxHandlePosition - this.minHandleElement.position
					) + this.handleHalfDimension
				);
				position = Math.floor(
					this.minHandleElement.position + this.handleHalfDimension
				);
			} else {
				dimension =
					this.minHandleElement.position + this.handleHalfDimension;
				position = 0;
			}
		}
		this.selectionBarElement.setDimension(dimension);
		this.selectionBarElement.setPosition(position);
		if (this.range && this.viewOptions.showOuterSelectionBars) {
			if (this.viewOptions.rightToLeft) {
				this.rightOuterSelectionBarElement.setDimension(position);
				this.rightOuterSelectionBarElement.setPosition(0);
				this.fullBarElement.calculateDimension();
				this.leftOuterSelectionBarElement.setDimension(
					this.fullBarElement.dimension - (position + dimension)
				);
				this.leftOuterSelectionBarElement.setPosition(
					position + dimension
				);
			} else {
				this.leftOuterSelectionBarElement.setDimension(position);
				this.leftOuterSelectionBarElement.setPosition(0);
				this.fullBarElement.calculateDimension();
				this.rightOuterSelectionBarElement.setDimension(
					this.fullBarElement.dimension - (position + dimension)
				);
				this.rightOuterSelectionBarElement.setPosition(
					position + dimension
				);
			}
		}
		if (
			!ValueHelper.isNullOrUndefined(
				this.viewOptions.getSelectionBarColor
			)
		) {
			const color: string = this.getSelectionBarColor();
			this.barStyle = {
				backgroundColor: color
			};
		} else if (
			!ValueHelper.isNullOrUndefined(
				this.viewOptions.selectionBarGradient
			)
		) {
			const offset: number = !ValueHelper.isNullOrUndefined(
				this.viewOptions.showSelectionBarFromValue
			)
				? this.valueToPosition(
						this.viewOptions.showSelectionBarFromValue
				  )
				: 0;
			const reversed: boolean =
				(offset - position > 0 && !isSelectionBarFromRight) ||
				(offset - position <= 0 && isSelectionBarFromRight);
			const direction: string = this.viewOptions.vertical
				? reversed
					? 'bottom'
					: 'top'
				: reversed
				? 'left'
				: 'right';
			this.barStyle = {
				backgroundImage:
					'linear-gradient(to ' +
					direction +
					', ' +
					this.viewOptions.selectionBarGradient.from +
					' 0%,' +
					this.viewOptions.selectionBarGradient.to +
					' 100%)'
			};
			if (this.viewOptions.vertical) {
				this.barStyle.backgroundPosition =
					'center ' +
					(offset +
						dimension +
						position +
						(reversed ? -this.handleHalfDimension : 0)) +
					'px';
				this.barStyle.backgroundSize =
					'100% ' +
					(this.fullBarElement.dimension - this.handleHalfDimension) +
					'px';
			} else {
				this.barStyle.backgroundPosition =
					offset -
					position +
					(reversed ? this.handleHalfDimension : 0) +
					'px center';
				this.barStyle.backgroundSize =
					this.fullBarElement.dimension -
					this.handleHalfDimension +
					'px 100%';
			}
		}
	}

	// Wrapper around the getSelectionBarColor of the user to pass to correct parameters
	private getSelectionBarColor(): string {
		if (this.range) {
			return this.viewOptions.getSelectionBarColor(
				this.value,
				this.highValue
			);
		}
		return this.viewOptions.getSelectionBarColor(this.value);
	}

	// Wrapper around the getPointerColor of the user to pass to  correct parameters
	private getPointerColor(pointerType: PointerType): string {
		if (pointerType === PointerType.Max) {
			return this.viewOptions.getPointerColor(
				this.highValue,
				pointerType
			);
		}
		return this.viewOptions.getPointerColor(this.value, pointerType);
	}

	// Wrapper around the getTickColor of the user to pass to correct parameters
	private getTickColor(value: number): string {
		return this.viewOptions.getTickColor(value);
	}

	// Update combined label position and value
	private updateCombinedLabel(): void {
		let isLabelOverlap: boolean = null;
		if (this.viewOptions.rightToLeft) {
			isLabelOverlap =
				this.minHandleLabelElement.position -
					this.minHandleLabelElement.dimension -
					10 <=
				this.maxHandleLabelElement.position;
		} else {
			isLabelOverlap =
				this.minHandleLabelElement.position +
					this.minHandleLabelElement.dimension +
					10 >=
				this.maxHandleLabelElement.position;
		}

		if (isLabelOverlap) {
			const lowDisplayValue: string = this.getDisplayValue(
				this.viewLowValue,
				LabelType.Low
			);
			const highDisplayValue: string = this.getDisplayValue(
				this.viewHighValue,
				LabelType.High
			);
			const combinedLabelValue: string = this.viewOptions.rightToLeft
				? this.viewOptions.combineLabels(
						highDisplayValue,
						lowDisplayValue
				  )
				: this.viewOptions.combineLabels(
						lowDisplayValue,
						highDisplayValue
				  );

			this.combinedLabelElement.setValue(combinedLabelValue);
			const pos: number = this.viewOptions.boundPointerLabels
				? Math.min(
						Math.max(
							this.selectionBarElement.position +
								this.selectionBarElement.dimension / 2 -
								this.combinedLabelElement.dimension / 2,
							0
						),
						this.fullBarElement.dimension -
							this.combinedLabelElement.dimension
				  )
				: this.selectionBarElement.position +
				  this.selectionBarElement.dimension / 2 -
				  this.combinedLabelElement.dimension / 2;

			this.combinedLabelElement.setPosition(pos);
			this.minHandleLabelElement.hide();
			this.maxHandleLabelElement.hide();
			this.combinedLabelElement.show();
		} else {
			this.updateHighHandle(this.valueToPosition(this.viewHighValue));
			this.updateLowHandle(this.valueToPosition(this.viewLowValue));
			this.maxHandleLabelElement.show();
			this.minHandleLabelElement.show();
			this.combinedLabelElement.hide();
		}
		if (this.viewOptions.autoHideLimitLabels) {
			this.updateFloorAndCeilLabelsVisibility();
		}
	}

	// Return the translated value if a translate function is provided else the original value
	private getDisplayValue(value: number, which: LabelType): string {
		if (
			!ValueHelper.isNullOrUndefined(this.viewOptions.stepsArray) &&
			!this.viewOptions.bindIndexForStepsArray
		) {
			value = this.getStepValue(value);
		}
		return this.viewOptions.translate(value, which);
	}

	// Round value to step and precision based on minValue
	private roundStep(value: number, customStep?: number): number {
		const step: number = !ValueHelper.isNullOrUndefined(customStep)
			? customStep
			: this.viewOptions.step;
		let steppedDifference: number = MathHelper.roundToPrecisionLimit(
			(value - this.viewOptions.floor) / step,
			this.viewOptions.precisionLimit
		);
		steppedDifference = Math.round(steppedDifference) * step;
		return MathHelper.roundToPrecisionLimit(
			this.viewOptions.floor + steppedDifference,
			this.viewOptions.precisionLimit
		);
	}

	// Translate value to pixel position
	private valueToPosition(val: number): number {
		let fn: ValueToPositionFunction = ValueHelper.linearValueToPosition;
		if (
			!ValueHelper.isNullOrUndefined(
				this.viewOptions.customValueToPosition
			)
		) {
			fn = this.viewOptions.customValueToPosition;
		} else if (this.viewOptions.logScale) {
			fn = ValueHelper.logValueToPosition;
		}

		val = MathHelper.clampToRange(
			val,
			this.viewOptions.floor,
			this.viewOptions.ceil
		);
		let percent: number = fn(
			val,
			this.viewOptions.floor,
			this.viewOptions.ceil
		);
		if (ValueHelper.isNullOrUndefined(percent)) {
			percent = 0;
		}
		if (this.viewOptions.rightToLeft) {
			percent = 1 - percent;
		}
		return percent * this.maxHandlePosition;
	}

	// Translate position to model value
	private positionToValue(position: number): number {
		let percent: number = position / this.maxHandlePosition;
		if (this.viewOptions.rightToLeft) {
			percent = 1 - percent;
		}
		let fn: PositionToValueFunction = ValueHelper.linearPositionToValue;
		if (
			!ValueHelper.isNullOrUndefined(
				this.viewOptions.customPositionToValue
			)
		) {
			fn = this.viewOptions.customPositionToValue;
		} else if (this.viewOptions.logScale) {
			fn = ValueHelper.logPositionToValue;
		}
		const value: number = fn(
			percent,
			this.viewOptions.floor,
			this.viewOptions.ceil
		);
		return !ValueHelper.isNullOrUndefined(value) ? value : 0;
	}

	// Get the X-coordinate or Y-coordinate of an event
	private getEventXY(
		event: MouseEvent | TouchEvent,
		targetTouchId?: number
	): number {
		if (event instanceof MouseEvent) {
			return this.viewOptions.vertical ? event.clientY : event.clientX;
		}

		let touchIndex: number = 0;
		const touches: TouchList = event.touches;
		if (!ValueHelper.isNullOrUndefined(targetTouchId)) {
			for (let i: number = 0; i < touches.length; i++) {
				if (touches[i].identifier === targetTouchId) {
					touchIndex = i;
					break;
				}
			}
		}

		// Return the target touch or if the target touch was not found in the event
		// returns the coordinates of the first touch
		return this.viewOptions.vertical
			? touches[touchIndex].clientY
			: touches[touchIndex].clientX;
	}

	// Compute the event position depending on whether the slider is horizontal or vertical
	private getEventPosition(
		event: MouseEvent | TouchEvent,
		targetTouchId?: number
	): number {
		const sliderElementBoundingRect: ClientRect = this.elementRef.nativeElement.getBoundingClientRect();

		const sliderPos: number = this.viewOptions.vertical
			? sliderElementBoundingRect.bottom
			: sliderElementBoundingRect.left;
		let eventPos: number = 0;
		if (this.viewOptions.vertical) {
			eventPos = -this.getEventXY(event, targetTouchId) + sliderPos;
		} else {
			eventPos = this.getEventXY(event, targetTouchId) - sliderPos;
		}
		return eventPos * this.viewOptions.scale - this.handleHalfDimension;
	}

	// Get the handle closest to an event
	private getNearestHandle(event: MouseEvent | TouchEvent): PointerType {
		if (!this.range) {
			return PointerType.Min;
		}

		const position: number = this.getEventPosition(event);
		const distanceMin: number = Math.abs(
			position - this.minHandleElement.position
		);
		const distanceMax: number = Math.abs(
			position - this.maxHandleElement.position
		);

		if (distanceMin < distanceMax) {
			return PointerType.Min;
		} else if (distanceMin > distanceMax) {
			return PointerType.Max;
		} else if (!this.viewOptions.rightToLeft) {
			// if event is at the same distance from min/max then if it's at left of minH, we return minH else maxH
			return position < this.minHandleElement.position
				? PointerType.Min
				: PointerType.Max;
		}
		// reverse in rtl
		return position > this.minHandleElement.position
			? PointerType.Min
			: PointerType.Max;
	}

	// Bind mouse and touch events to slider handles
	private bindEvents(): void {
		const draggableRange: boolean = this.viewOptions.draggableRange;

		if (!this.viewOptions.onlyBindHandles) {
			this.selectionBarElement.on(
				'mousedown',
				(event: MouseEvent): void =>
					this.onBarStart(
						null,
						draggableRange,
						event,
						true,
						true,
						true
					)
			);
		}

		if (this.viewOptions.draggableRangeOnly) {
			this.minHandleElement.on('mousedown', (event: MouseEvent): void =>
				this.onBarStart(
					PointerType.Min,
					draggableRange,
					event,
					true,
					true
				)
			);
			this.maxHandleElement.on('mousedown', (event: MouseEvent): void =>
				this.onBarStart(
					PointerType.Max,
					draggableRange,
					event,
					true,
					true
				)
			);
		} else {
			this.minHandleElement.on('mousedown', (event: MouseEvent): void =>
				this.onStart(PointerType.Min, event, true, true)
			);

			if (this.range) {
				this.maxHandleElement.on(
					'mousedown',
					(event: MouseEvent): void =>
						this.onStart(PointerType.Max, event, true, true)
				);
			}
			if (!this.viewOptions.onlyBindHandles) {
				this.fullBarElement.on('mousedown', (event: MouseEvent): void =>
					this.onStart(null, event, true, true, true)
				);
				this.ticksElement.on('mousedown', (event: MouseEvent): void =>
					this.onStart(null, event, true, true, true, true)
				);
			}
		}

		if (!this.viewOptions.onlyBindHandles) {
			this.selectionBarElement.onPassive(
				'touchstart',
				(event: TouchEvent): void =>
					this.onBarStart(
						null,
						draggableRange,
						event,
						true,
						true,
						true
					)
			);
		}
		if (this.viewOptions.draggableRangeOnly) {
			this.minHandleElement.onPassive(
				'touchstart',
				(event: TouchEvent): void =>
					this.onBarStart(
						PointerType.Min,
						draggableRange,
						event,
						true,
						true
					)
			);
			this.maxHandleElement.onPassive(
				'touchstart',
				(event: TouchEvent): void =>
					this.onBarStart(
						PointerType.Max,
						draggableRange,
						event,
						true,
						true
					)
			);
		} else {
			this.minHandleElement.onPassive(
				'touchstart',
				(event: TouchEvent): void =>
					this.onStart(PointerType.Min, event, true, true)
			);
			if (this.range) {
				this.maxHandleElement.onPassive(
					'touchstart',
					(event: TouchEvent): void =>
						this.onStart(PointerType.Max, event, true, true)
				);
			}
			if (!this.viewOptions.onlyBindHandles) {
				this.fullBarElement.onPassive(
					'touchstart',
					(event: TouchEvent): void =>
						this.onStart(null, event, true, true, true)
				);
				this.ticksElement.onPassive(
					'touchstart',
					(event: TouchEvent): void =>
						this.onStart(null, event, false, false, true, true)
				);
			}
		}

		if (this.viewOptions.keyboardSupport) {
			this.minHandleElement.on('focus', (): void =>
				this.onPointerFocus(PointerType.Min)
			);
			if (this.range) {
				this.maxHandleElement.on('focus', (): void =>
					this.onPointerFocus(PointerType.Max)
				);
			}
		}
	}

	// Unbind mouse and touch events to slider handles
	private unbindEvents(): void {
		this.unsubscribeOnMove();
		this.unsubscribeOnEnd();

		for (const element of this.getAllSliderElements()) {
			element.off();
		}
	}

	private onBarStart(
		pointerType: PointerType,
		draggableRange: boolean,
		event: MouseEvent | TouchEvent,
		bindMove: boolean,
		bindEnd: boolean,
		simulateImmediateMove?: boolean,
		simulateImmediateEnd?: boolean
	): void {
		if (draggableRange) {
			this.onDragStart(pointerType, event, bindMove, bindEnd);
		} else {
			this.onStart(
				pointerType,
				event,
				bindMove,
				bindEnd,
				simulateImmediateMove,
				simulateImmediateEnd
			);
		}
	}

	// onStart event handler
	private onStart(
		pointerType: PointerType,
		event: MouseEvent | TouchEvent,
		bindMove: boolean,
		bindEnd: boolean,
		simulateImmediateMove?: boolean,
		simulateImmediateEnd?: boolean
	): void {
		event.stopPropagation();
		// Only call preventDefault() when handling non-passive events (passive events don't need it)
		if (
			!CompatibilityHelper.isTouchEvent(event) ||
			!detectPassiveEvents.hasSupport
		) {
			event.preventDefault();
		}

		// We have to do this in case the HTML where the sliders are on
		// have been animated into view.
		this.calculateViewDimensions();

		if (ValueHelper.isNullOrUndefined(pointerType)) {
			pointerType = this.getNearestHandle(event);
		}

		this.currentTrackingPointer = pointerType;

		const pointerElement: SliderHandleDirective = this.getPointerElement(
			pointerType
		);
		pointerElement.active = true;

		if (this.viewOptions.keyboardSupport) {
			pointerElement.focus();
		}

		if (bindMove) {
			this.unsubscribeOnMove();

			const onMoveCallback: (e: MouseEvent | TouchEvent) => void = (
				e: MouseEvent | TouchEvent
			): void =>
				this.dragging.active ? this.onDragMove(e) : this.onMove(e);

			if (CompatibilityHelper.isTouchEvent(event)) {
				this.onMoveEventListener = this.eventListenerHelper.attachPassiveEventListener(
					document,
					'touchmove',
					onMoveCallback,
					this.viewOptions.touchEventsInterval
				);
			} else {
				this.onMoveEventListener = this.eventListenerHelper.attachEventListener(
					document,
					'mousemove',
					onMoveCallback,
					this.viewOptions.mouseEventsInterval
				);
			}
		}

		if (bindEnd) {
			this.unsubscribeOnEnd();

			const onEndCallback: (e: MouseEvent | TouchEvent) => void = (
				e: MouseEvent | TouchEvent
			): void => this.onEnd(e);

			if (CompatibilityHelper.isTouchEvent(event)) {
				this.onEndEventListener = this.eventListenerHelper.attachPassiveEventListener(
					document,
					'touchend',
					onEndCallback
				);
			} else {
				this.onEndEventListener = this.eventListenerHelper.attachEventListener(
					document,
					'mouseup',
					onEndCallback
				);
			}
		}

		this.userChangeStart.emit(this.getChangeContext());

		if (
			CompatibilityHelper.isTouchEvent(event) &&
			!ValueHelper.isNullOrUndefined((event as TouchEvent).changedTouches)
		) {
			// Store the touch identifier
			if (ValueHelper.isNullOrUndefined(this.touchId)) {
				this.touchId = (event as TouchEvent).changedTouches[0].identifier;
			}
		}

		// Click events, either with mouse or touch gesture are weird. Sometimes they result in full
		// start, move, end sequence, and sometimes, they don't - they only invoke mousedown
		// As a workaround, we simulate the first move event and the end event if it's necessary
		if (simulateImmediateMove) {
			this.onMove(event, true);
		}

		if (simulateImmediateEnd) {
			this.onEnd(event);
		}
	}

	// onMove event handler
	private onMove(event: MouseEvent | TouchEvent, fromTick?: boolean): void {
		let touchForThisSlider: Touch = null;

		if (CompatibilityHelper.isTouchEvent(event)) {
			const changedTouches: TouchList = (event as TouchEvent)
				.changedTouches;
			for (let i: number = 0; i < changedTouches.length; i++) {
				if (changedTouches[i].identifier === this.touchId) {
					touchForThisSlider = changedTouches[i];
					break;
				}
			}

			if (ValueHelper.isNullOrUndefined(touchForThisSlider)) {
				return;
			}
		}

		const newPos: number = !ValueHelper.isNullOrUndefined(
			touchForThisSlider
		)
			? this.getEventPosition(event, touchForThisSlider.identifier)
			: this.getEventPosition(event);
		let newValue: number;
		const ceilValue: number = this.viewOptions.rightToLeft
			? this.viewOptions.floor
			: this.viewOptions.ceil;
		const floorValue: number = this.viewOptions.rightToLeft
			? this.viewOptions.ceil
			: this.viewOptions.floor;

		if (newPos <= 0) {
			newValue = floorValue;
		} else if (newPos >= this.maxHandlePosition) {
			newValue = ceilValue;
		} else {
			newValue = this.positionToValue(newPos);
			if (
				fromTick &&
				!ValueHelper.isNullOrUndefined(this.viewOptions.tickStep)
			) {
				newValue = this.roundStep(newValue, this.viewOptions.tickStep);
			} else {
				newValue = this.roundStep(newValue);
			}
		}
		this.positionTrackingHandle(newValue);
	}

	private onEnd(event: MouseEvent | TouchEvent): void {
		if (CompatibilityHelper.isTouchEvent(event)) {
			const changedTouches: TouchList = (event as TouchEvent)
				.changedTouches;
			if (changedTouches[0].identifier !== this.touchId) {
				return;
			}
		}

		this.touchId = null;

		if (!this.viewOptions.keyboardSupport) {
			this.minHandleElement.active = false;
			this.maxHandleElement.active = false;
			this.currentTrackingPointer = null;
		}
		this.dragging.active = false;

		this.unsubscribeOnMove();
		this.unsubscribeOnEnd();

		this.userChangeEnd.emit(this.getChangeContext());
	}

	private onPointerFocus(pointerType: PointerType): void {
		const pointerElement: SliderHandleDirective = this.getPointerElement(
			pointerType
		);
		pointerElement.on('blur', (): void =>
			this.onPointerBlur(pointerElement)
		);
		pointerElement.on('keydown', (event: KeyboardEvent): void =>
			this.onKeyboardEvent(event)
		);
		pointerElement.on('keyup', (): void => this.onKeyUp());
		pointerElement.active = true;

		this.currentTrackingPointer = pointerType;
		this.currentFocusPointer = pointerType;
		this.firstKeyDown = true;
	}

	private onKeyUp(): void {
		this.firstKeyDown = true;
		this.userChangeEnd.emit(this.getChangeContext());
	}

	private onPointerBlur(pointer: SliderHandleDirective): void {
		pointer.off('blur');
		pointer.off('keydown');
		pointer.off('keyup');
		pointer.active = false;
		if (ValueHelper.isNullOrUndefined(this.touchId)) {
			this.currentTrackingPointer = null;
			this.currentFocusPointer = null;
		}
	}

	private getKeyActions(currentValue: number): { [key: string]: number } {
		const valueRange: number =
			this.viewOptions.ceil - this.viewOptions.floor;

		let increaseStep: number = currentValue + this.viewOptions.step;
		let decreaseStep: number = currentValue - this.viewOptions.step;
		let increasePage: number = currentValue + valueRange / 10;
		let decreasePage: number = currentValue - valueRange / 10;

		if (this.viewOptions.reversedControls) {
			increaseStep = currentValue - this.viewOptions.step;
			decreaseStep = currentValue + this.viewOptions.step;
			increasePage = currentValue - valueRange / 10;
			decreasePage = currentValue + valueRange / 10;
		}

		// Left to right default actions
		const actions: { [key: string]: number } = {
			UP: increaseStep,
			DOWN: decreaseStep,
			LEFT: decreaseStep,
			RIGHT: increaseStep,
			PAGEUP: increasePage,
			PAGEDOWN: decreasePage,
			HOME: this.viewOptions.reversedControls
				? this.viewOptions.ceil
				: this.viewOptions.floor,
			END: this.viewOptions.reversedControls
				? this.viewOptions.floor
				: this.viewOptions.ceil
		};
		// right to left means swapping right and left arrows
		if (this.viewOptions.rightToLeft) {
			actions.LEFT = increaseStep;
			actions.RIGHT = decreaseStep;
			// right to left and vertical means we also swap up and down
			if (this.viewOptions.vertical) {
				actions.UP = decreaseStep;
				actions.DOWN = increaseStep;
			}
		}
		return actions;
	}

	private onKeyboardEvent(event: KeyboardEvent): void {
		const currentValue: number = this.getCurrentTrackingValue();
		const keyCode: number = !ValueHelper.isNullOrUndefined(event.keyCode)
			? event.keyCode
			: event.which;
		const keys: { [keyCode: number]: string } = {
			38: 'UP',
			40: 'DOWN',
			37: 'LEFT',
			39: 'RIGHT',
			33: 'PAGEUP',
			34: 'PAGEDOWN',
			36: 'HOME',
			35: 'END'
		};
		const actions: { [key: string]: number } = this.getKeyActions(
			currentValue
		);
		const key: string = keys[keyCode];
		const action: number = actions[key];

		if (
			ValueHelper.isNullOrUndefined(action) ||
			ValueHelper.isNullOrUndefined(this.currentTrackingPointer)
		) {
			return;
		}
		event.preventDefault();

		if (this.firstKeyDown) {
			this.firstKeyDown = false;
			this.userChangeStart.emit(this.getChangeContext());
		}

		const actionValue: number = MathHelper.clampToRange(
			action,
			this.viewOptions.floor,
			this.viewOptions.ceil
		);
		const newValue: number = this.roundStep(actionValue);
		if (!this.viewOptions.draggableRangeOnly) {
			this.positionTrackingHandle(newValue);
		} else {
			const difference: number = this.viewHighValue - this.viewLowValue;
			let newMinValue: number;
			let newMaxValue: number;

			if (this.currentTrackingPointer === PointerType.Min) {
				newMinValue = newValue;
				newMaxValue = newValue + difference;
				if (newMaxValue > this.viewOptions.ceil) {
					newMaxValue = this.viewOptions.ceil;
					newMinValue = newMaxValue - difference;
				}
			} else if (this.currentTrackingPointer === PointerType.Max) {
				newMaxValue = newValue;
				newMinValue = newValue - difference;
				if (newMinValue < this.viewOptions.floor) {
					newMinValue = this.viewOptions.floor;
					newMaxValue = newMinValue + difference;
				}
			}
			this.positionTrackingBar(newMinValue, newMaxValue);
		}
	}

	// onDragStart event handler, handles dragging of the middle bar
	private onDragStart(
		pointerType: PointerType,
		event: MouseEvent | TouchEvent,
		bindMove: boolean,
		bindEnd: boolean
	): void {
		const position: number = this.getEventPosition(event);

		this.dragging = new Dragging();
		this.dragging.active = true;
		this.dragging.value = this.positionToValue(position);
		this.dragging.difference = this.viewHighValue - this.viewLowValue;
		this.dragging.lowLimit = this.viewOptions.rightToLeft
			? this.minHandleElement.position - position
			: position - this.minHandleElement.position;
		this.dragging.highLimit = this.viewOptions.rightToLeft
			? position - this.maxHandleElement.position
			: this.maxHandleElement.position - position;

		this.onStart(pointerType, event, bindMove, bindEnd);
	}

	/** Get min value depending on whether the newPos is outOfBounds above or below the bar and rightToLeft */
	private getMinValue(
		newPos: number,
		outOfBounds: boolean,
		isAbove: boolean
	): number {
		const isRTL: boolean = this.viewOptions.rightToLeft;
		let value: number = null;

		if (outOfBounds) {
			if (isAbove) {
				value = isRTL
					? this.viewOptions.floor
					: this.viewOptions.ceil - this.dragging.difference;
			} else {
				value = isRTL
					? this.viewOptions.ceil - this.dragging.difference
					: this.viewOptions.floor;
			}
		} else {
			value = isRTL
				? this.positionToValue(newPos + this.dragging.lowLimit)
				: this.positionToValue(newPos - this.dragging.lowLimit);
		}
		return this.roundStep(value);
	}

	/** Get max value depending on whether the newPos is outOfBounds above or below the bar and rightToLeft */
	private getMaxValue(
		newPos: number,
		outOfBounds: boolean,
		isAbove: boolean
	): number {
		const isRTL: boolean = this.viewOptions.rightToLeft;
		let value: number = null;

		if (outOfBounds) {
			if (isAbove) {
				value = isRTL
					? this.viewOptions.floor + this.dragging.difference
					: this.viewOptions.ceil;
			} else {
				value = isRTL
					? this.viewOptions.ceil
					: this.viewOptions.floor + this.dragging.difference;
			}
		} else {
			if (isRTL) {
				value =
					this.positionToValue(newPos + this.dragging.lowLimit) +
					this.dragging.difference;
			} else {
				value =
					this.positionToValue(newPos - this.dragging.lowLimit) +
					this.dragging.difference;
			}
		}

		return this.roundStep(value);
	}

	private onDragMove(event?: MouseEvent | TouchEvent): void {
		const newPos: number = this.getEventPosition(event);

		let ceilLimit: number,
			floorLimit: number,
			floorHandleElement: SliderHandleDirective,
			ceilHandleElement: SliderHandleDirective;
		if (this.viewOptions.rightToLeft) {
			ceilLimit = this.dragging.lowLimit;
			floorLimit = this.dragging.highLimit;
			floorHandleElement = this.maxHandleElement;
			ceilHandleElement = this.minHandleElement;
		} else {
			ceilLimit = this.dragging.highLimit;
			floorLimit = this.dragging.lowLimit;
			floorHandleElement = this.minHandleElement;
			ceilHandleElement = this.maxHandleElement;
		}

		const isUnderFloorLimit: boolean = newPos <= floorLimit;
		const isOverCeilLimit: boolean =
			newPos >= this.maxHandlePosition - ceilLimit;

		let newMinValue: number;
		let newMaxValue: number;
		if (isUnderFloorLimit) {
			if (floorHandleElement.position === 0) {
				return;
			}
			newMinValue = this.getMinValue(newPos, true, false);
			newMaxValue = this.getMaxValue(newPos, true, false);
		} else if (isOverCeilLimit) {
			if (ceilHandleElement.position === this.maxHandlePosition) {
				return;
			}
			newMaxValue = this.getMaxValue(newPos, true, true);
			newMinValue = this.getMinValue(newPos, true, true);
		} else {
			newMinValue = this.getMinValue(newPos, false, false);
			newMaxValue = this.getMaxValue(newPos, false, false);
		}

		this.positionTrackingBar(newMinValue, newMaxValue);
	}

	// Set the new value and position for the entire bar
	private positionTrackingBar(
		newMinValue: number,
		newMaxValue: number
	): void {
		if (
			!ValueHelper.isNullOrUndefined(this.viewOptions.minLimit) &&
			newMinValue < this.viewOptions.minLimit
		) {
			newMinValue = this.viewOptions.minLimit;
			newMaxValue = MathHelper.roundToPrecisionLimit(
				newMinValue + this.dragging.difference,
				this.viewOptions.precisionLimit
			);
		}
		if (
			!ValueHelper.isNullOrUndefined(this.viewOptions.maxLimit) &&
			newMaxValue > this.viewOptions.maxLimit
		) {
			newMaxValue = this.viewOptions.maxLimit;
			newMinValue = MathHelper.roundToPrecisionLimit(
				newMaxValue - this.dragging.difference,
				this.viewOptions.precisionLimit
			);
		}

		this.viewLowValue = newMinValue;
		this.viewHighValue = newMaxValue;
		this.applyViewChange();
		this.updateHandles(PointerType.Min, this.valueToPosition(newMinValue));
		this.updateHandles(PointerType.Max, this.valueToPosition(newMaxValue));
	}

	// Set the new value and position to the current tracking handle
	private positionTrackingHandle(newValue: number): void {
		newValue = this.applyMinMaxLimit(newValue);
		if (this.range) {
			if (this.viewOptions.pushRange) {
				newValue = this.applyPushRange(newValue);
			} else {
				if (this.viewOptions.noSwitching) {
					if (
						this.currentTrackingPointer === PointerType.Min &&
						newValue > this.viewHighValue
					) {
						newValue = this.applyMinMaxRange(this.viewHighValue);
					} else if (
						this.currentTrackingPointer === PointerType.Max &&
						newValue < this.viewLowValue
					) {
						newValue = this.applyMinMaxRange(this.viewLowValue);
					}
				}
				newValue = this.applyMinMaxRange(newValue);
				/* This is to check if we need to switch the min and max handles */
				if (
					this.currentTrackingPointer === PointerType.Min &&
					newValue > this.viewHighValue
				) {
					this.viewLowValue = this.viewHighValue;
					this.applyViewChange();
					this.updateHandles(
						PointerType.Min,
						this.maxHandleElement.position
					);
					this.updateAriaAttributes();
					this.currentTrackingPointer = PointerType.Max;
					this.minHandleElement.active = false;
					this.maxHandleElement.active = true;
					if (this.viewOptions.keyboardSupport) {
						this.maxHandleElement.focus();
					}
				} else if (
					this.currentTrackingPointer === PointerType.Max &&
					newValue < this.viewLowValue
				) {
					this.viewHighValue = this.viewLowValue;
					this.applyViewChange();
					this.updateHandles(
						PointerType.Max,
						this.minHandleElement.position
					);
					this.updateAriaAttributes();
					this.currentTrackingPointer = PointerType.Min;
					this.maxHandleElement.active = false;
					this.minHandleElement.active = true;
					if (this.viewOptions.keyboardSupport) {
						this.minHandleElement.focus();
					}
				}
			}
		}

		if (this.getCurrentTrackingValue() !== newValue) {
			if (this.currentTrackingPointer === PointerType.Min) {
				this.viewLowValue = newValue;
				this.applyViewChange();
			} else if (this.currentTrackingPointer === PointerType.Max) {
				this.viewHighValue = newValue;
				this.applyViewChange();
			}
			this.updateHandles(
				this.currentTrackingPointer,
				this.valueToPosition(newValue)
			);
			this.updateAriaAttributes();
		}
	}

	private applyMinMaxLimit(newValue: number): number {
		if (
			!ValueHelper.isNullOrUndefined(this.viewOptions.minLimit) &&
			newValue < this.viewOptions.minLimit
		) {
			return this.viewOptions.minLimit;
		}
		if (
			!ValueHelper.isNullOrUndefined(this.viewOptions.maxLimit) &&
			newValue > this.viewOptions.maxLimit
		) {
			return this.viewOptions.maxLimit;
		}
		return newValue;
	}

	private applyMinMaxRange(newValue: number): number {
		const oppositeValue: number =
			this.currentTrackingPointer === PointerType.Min
				? this.viewHighValue
				: this.viewLowValue;
		const difference: number = Math.abs(newValue - oppositeValue);
		if (!ValueHelper.isNullOrUndefined(this.viewOptions.minRange)) {
			if (difference < this.viewOptions.minRange) {
				if (this.currentTrackingPointer === PointerType.Min) {
					return MathHelper.roundToPrecisionLimit(
						this.viewHighValue - this.viewOptions.minRange,
						this.viewOptions.precisionLimit
					);
				} else if (this.currentTrackingPointer === PointerType.Max) {
					return MathHelper.roundToPrecisionLimit(
						this.viewLowValue + this.viewOptions.minRange,
						this.viewOptions.precisionLimit
					);
				}
			}
		}
		if (!ValueHelper.isNullOrUndefined(this.viewOptions.maxRange)) {
			if (difference > this.viewOptions.maxRange) {
				if (this.currentTrackingPointer === PointerType.Min) {
					return MathHelper.roundToPrecisionLimit(
						this.viewHighValue - this.viewOptions.maxRange,
						this.viewOptions.precisionLimit
					);
				} else if (this.currentTrackingPointer === PointerType.Max) {
					return MathHelper.roundToPrecisionLimit(
						this.viewLowValue + this.viewOptions.maxRange,
						this.viewOptions.precisionLimit
					);
				}
			}
		}
		return newValue;
	}

	private applyPushRange(newValue: number): number {
		const difference: number =
			this.currentTrackingPointer === PointerType.Min
				? this.viewHighValue - newValue
				: newValue - this.viewLowValue;
		const minRange: number = !ValueHelper.isNullOrUndefined(
			this.viewOptions.minRange
		)
			? this.viewOptions.minRange
			: this.viewOptions.step;
		const maxRange: number = this.viewOptions.maxRange;
		// if smaller than minRange
		if (difference < minRange) {
			if (this.currentTrackingPointer === PointerType.Min) {
				this.viewHighValue = MathHelper.roundToPrecisionLimit(
					Math.min(newValue + minRange, this.viewOptions.ceil),
					this.viewOptions.precisionLimit
				);
				newValue = MathHelper.roundToPrecisionLimit(
					this.viewHighValue - minRange,
					this.viewOptions.precisionLimit
				);
				this.applyViewChange();
				this.updateHandles(
					PointerType.Max,
					this.valueToPosition(this.viewHighValue)
				);
			} else if (this.currentTrackingPointer === PointerType.Max) {
				this.viewLowValue = MathHelper.roundToPrecisionLimit(
					Math.max(newValue - minRange, this.viewOptions.floor),
					this.viewOptions.precisionLimit
				);
				newValue = MathHelper.roundToPrecisionLimit(
					this.viewLowValue + minRange,
					this.viewOptions.precisionLimit
				);
				this.applyViewChange();
				this.updateHandles(
					PointerType.Min,
					this.valueToPosition(this.viewLowValue)
				);
			}
			this.updateAriaAttributes();
		} else if (
			!ValueHelper.isNullOrUndefined(maxRange) &&
			difference > maxRange
		) {
			// if greater than maxRange
			if (this.currentTrackingPointer === PointerType.Min) {
				this.viewHighValue = MathHelper.roundToPrecisionLimit(
					newValue + maxRange,
					this.viewOptions.precisionLimit
				);
				this.applyViewChange();
				this.updateHandles(
					PointerType.Max,
					this.valueToPosition(this.viewHighValue)
				);
			} else if (this.currentTrackingPointer === PointerType.Max) {
				this.viewLowValue = MathHelper.roundToPrecisionLimit(
					newValue - maxRange,
					this.viewOptions.precisionLimit
				);
				this.applyViewChange();
				this.updateHandles(
					PointerType.Min,
					this.valueToPosition(this.viewLowValue)
				);
			}
			this.updateAriaAttributes();
		}
		return newValue;
	}

	private getChangeContext(): ChangeContext {
		const changeContext: ChangeContext = new ChangeContext();
		changeContext.pointerType = this.currentTrackingPointer;
		changeContext.value = +this.value;
		if (this.range) {
			changeContext.highValue = +this.highValue;
		}
		return changeContext;
	}
}
