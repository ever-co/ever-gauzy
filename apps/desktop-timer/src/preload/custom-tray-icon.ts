import { ipcRenderer, IpcRendererEvent } from 'electron';

/**
 * Interface definitions for type safety
 */
interface ColorTheme {
	bgColor: string;
	txtColor: string;
}

interface ThemeColors {
	active: ColorTheme;
	stopped: ColorTheme;
}

interface ThemeConfig {
	dark: ThemeColors;
	light: ThemeColors;
}

interface TrayIconEventData {
	event: 'stopTimer' | 'updateTheme' | 'initCustomIcon' | 'updateTimer' | 'startTimer';
	timeText?: string;
	isStopped?: boolean;
}

interface TrayIconsResponse {
	activeIcon: string;
	grayIcon: string;
}

type ThemeType = 'dark' | 'light';

/**
 * Get the device pixel ratio for high-DPI displays
 */
function getDevicePixelRatio(): number {
	return window.devicePixelRatio > 2 ? window.devicePixelRatio : 2; // 2 for better resolution
}

/**
 * Canvas and Icon Dimensions (scaled for high-DPI)
 */
const SCALE_FACTOR = getDevicePixelRatio();
const BASE_TRAY_ICON_HEIGHT = 18;
const BASE_TRAY_ICON_SIZE = 18;
const BASE_ICON_AREA_WIDTH = BASE_TRAY_ICON_SIZE;
const BASE_TEXT_AREA_WIDTH = 70;

const TRAY_ICON_HEIGHT = BASE_TRAY_ICON_HEIGHT * SCALE_FACTOR;
const TRAY_ICON_SIZE = BASE_TRAY_ICON_SIZE * SCALE_FACTOR;
const ICON_AREA_WIDTH = BASE_ICON_AREA_WIDTH * SCALE_FACTOR;
const TEXT_AREA_WIDTH = BASE_TEXT_AREA_WIDTH * SCALE_FACTOR;
const TRAY_ICON_TOTAL_WIDTH = ICON_AREA_WIDTH + TEXT_AREA_WIDTH;

/**
 * Canvas Position Constants
 */
const CANVAS_START_X = 0;
const CANVAS_START_Y = 0;
const TEXT_VERTICAL_OFFSET = 0.8 * SCALE_FACTOR;

/**
 * Visual Style Constants
 */
const ICON_BACKGROUND_COLOR = '#808080'; // Gray color for icon area
const BORDER_RADIUS = 0; // Square corners (no rounding)
const DEFAULT_TIME_DISPLAY = '--:--:--'; // Shown when timer is stopped
const TIMER_FONT = `400 ${12 * SCALE_FACTOR}px -apple-system, SF Mono, monospace`;
const IMAGE_FORMAT = 'image/png';
let LAST_TIME_DISPLAY = DEFAULT_TIME_DISPLAY;

/**
 * Color Definitions for Different Themes
 */
const COLORS = {
	dark: {
		gray100: '#D3D3D3',
		gray900: '#111827',
		gray300: '#D1D5DB',
		gray600: '#374151'
	},
	light: {
		gray900: '#111827',
		gray50: '#F9FAFB',
		gray700: '#474747',
		gray100: '#EEF2F6'
	}
} as const;

/**
 * Icon State Management
 */
let activeTimerIconPath = '';
let stoppedTimerIconPath = '';

/**
 * Theme Configuration
 * Maps OS theme preference to appropriate color schemes for active and stopped states
 */
const THEME_COLOR_CONFIG: ThemeConfig = {
	dark: {
		active: {
			bgColor: COLORS.dark.gray100,
			txtColor: COLORS.dark.gray900
		},
		stopped: {
			bgColor: COLORS.dark.gray300,
			txtColor: COLORS.dark.gray600
		}
	},
	light: {
		active: {
			bgColor: COLORS.light.gray700,
			txtColor: COLORS.light.gray100
		},
		stopped: {
			bgColor: COLORS.light.gray700,
			txtColor: COLORS.light.gray100
		}
	}
};

/**
 * Currently active theme colors (mutable, updated based on OS theme)
 */
let currentThemeColors: ThemeColors = {
	...THEME_COLOR_CONFIG.dark
};

/**
 * Main Canvas Setup - Used for final tray icon rendering
 */
const mainCanvas = document.createElement('canvas');
const mainContext = mainCanvas.getContext('2d') as CanvasRenderingContext2D;
mainCanvas.width = TRAY_ICON_TOTAL_WIDTH;
mainCanvas.height = TRAY_ICON_HEIGHT;

/**
 * Background Canvas - Pre-rendered background for performance
 */
const backgroundCanvas = document.createElement('canvas');
const backgroundContext = backgroundCanvas.getContext('2d') as CanvasRenderingContext2D;
backgroundCanvas.width = TRAY_ICON_TOTAL_WIDTH;
backgroundCanvas.height = TRAY_ICON_HEIGHT;

/**
 * Currently loaded icon image (changes based on timer state)
 */
let loadedIconImage: HTMLImageElement | null = null;

/**
 * Loads the appropriate icon image based on timer state
 * @param isStopped - Whether the timer is currently stopped
 * @returns Promise that resolves when icon is loaded
 */
function loadIconImage(isStopped = true): Promise<void> {
	const iconPath = isStopped ? stoppedTimerIconPath : activeTimerIconPath;

	return new Promise<void>((resolve) => {
		const image = new Image();

		image.onload = (): void => {
			loadedIconImage = image;
			resolve();
		};

		image.onerror = (): void => {
			console.error(`Failed to load tray icon from path: ${iconPath}`);
			resolve();
		};

		image.src = iconPath;
	});
}

/**
 * Initializes theme colors based on system preference
 */
function initializeThemeColors(): void {
	const detectedTheme = detectSystemTheme();
	currentThemeColors.active = THEME_COLOR_CONFIG[detectedTheme].active;
	currentThemeColors.stopped = THEME_COLOR_CONFIG[detectedTheme].stopped;
}

/**
 * Detects the current system theme preference
 * @returns 'dark' if dark mode is enabled, 'light' otherwise
 */
function detectSystemTheme(): ThemeType {
	const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const theme = prefersDarkMode ? 'dark' : 'light';
	console.log(`System theme detected: ${theme}`);
	return theme;
}

/**
 * Renders the background layer of the tray icon
 * This includes the main background color and the icon area background
 * @param isTimerStopped - Whether the timer is currently stopped
 */
function renderBackgroundLayer(isTimerStopped = true): void {
	const canvasWidth = TRAY_ICON_TOTAL_WIDTH;
	const canvasHeight = TRAY_ICON_HEIGHT;

	// Clear previous background
	backgroundContext.clearRect(CANVAS_START_X, CANVAS_START_Y, canvasWidth, canvasHeight);

	// Select appropriate background color based on timer state
	const backgroundColor = isTimerStopped
		? currentThemeColors.stopped.bgColor
		: currentThemeColors.active.bgColor;

	// Draw main background rectangle
	backgroundContext.fillStyle = backgroundColor;
	backgroundContext.beginPath();
	backgroundContext.roundRect(CANVAS_START_X, CANVAS_START_Y, canvasWidth, canvasHeight, BORDER_RADIUS);
	backgroundContext.fill();

	// Draw icon area background (left side with distinct color)
	backgroundContext.fillStyle = ICON_BACKGROUND_COLOR;
	backgroundContext.beginPath();
	// Border radius array: [top-left, top-right, bottom-right, bottom-left]
	backgroundContext.roundRect(CANVAS_START_X, CANVAS_START_Y, ICON_AREA_WIDTH, canvasHeight, [BORDER_RADIUS, 0, 0, BORDER_RADIUS]);
	backgroundContext.fill();
}

/**
 * Renders the complete tray icon with time display
 * @param currentTime - The time to display (e.g., "01:23:45"). If not provided, shows default stopped text
 * @returns Base64 encoded PNG data URL of the rendered icon
 */
function renderTrayIconWithTime(currentTime?: string): string {
	const displayText = currentTime || DEFAULT_TIME_DISPLAY;
	const isTimerActive = Boolean(currentTime);
	const textColor = isTimerActive
		? currentThemeColors.active.txtColor
		: currentThemeColors.stopped.txtColor;

	mainContext.imageSmoothingEnabled = true;
	mainContext.imageSmoothingQuality = 'high';

	// Draw pre-rendered background onto main canvas
	mainContext.drawImage(backgroundCanvas, CANVAS_START_X, CANVAS_START_Y);

	// Draw the icon image (centered in icon area)
	if (loadedIconImage) {
		const iconPositionX = (ICON_AREA_WIDTH - TRAY_ICON_SIZE) / 2;
		const iconPositionY = (TRAY_ICON_HEIGHT - TRAY_ICON_SIZE) / 2;
		mainContext.drawImage(
			loadedIconImage,
			iconPositionX,
			iconPositionY,
			TRAY_ICON_SIZE,
			TRAY_ICON_SIZE
		);
	}

	// Draw time text (centered in text area)
	const textPositionX = ICON_AREA_WIDTH + (TEXT_AREA_WIDTH / 2);
	const textPositionY = (TRAY_ICON_HEIGHT / 2) + TEXT_VERTICAL_OFFSET;

	mainContext.fillStyle = textColor;
	mainContext.font = TIMER_FONT;
	mainContext.textAlign = 'center';
	mainContext.textBaseline = 'middle';
	mainContext.fillText(displayText, textPositionX, textPositionY);

	return mainCanvas.toDataURL(IMAGE_FORMAT);
}

function customTrayIconHandler(_event: IpcRendererEvent, data: TrayIconEventData): void {
	switch (data.event) {
		case 'stopTimer':
			handleStopTimer();
			break;
		case 'updateTheme':
			handleThemeUpdate(data.isStopped ?? true);
			break;
		case 'initCustomIcon':
			initializeTrayIcon();
			break;
		case 'updateTimer':
			handleTimerUpdate(data.timeText);
			break;
		case 'startTimer':
			handleStartTimer();
			break;
		default:
			console.warn(`Unknown tray icon event: ${data.event}`);
			break;
	}
}

/**
 * Initializes IPC communication listener for tray icon events
 */
export function initializeIpcListener(): void {
	ipcRenderer.removeListener('custom_tray_icon', customTrayIconHandler);
	ipcRenderer.on('custom_tray_icon', customTrayIconHandler);
}

/**
 * Initializes the custom tray icon system
 * Sets up theme, loads icons, and renders initial state
 */
export async function initializeTrayIcon(): Promise<void> {
	const INITIAL_TIMER_STATE_STOPPED = true;

	// Initialize theme colors based on system preference
	initializeThemeColors();

	// Request icon paths from main process
	const iconPaths = await ipcRenderer.invoke('set-tray-icon') as TrayIconsResponse;
	setIconPaths(iconPaths.activeIcon, iconPaths.grayIcon);

	// Load stopped state icon and render initial tray icon
	await loadIconImage(INITIAL_TIMER_STATE_STOPPED);
	renderBackgroundLayer(INITIAL_TIMER_STATE_STOPPED);
	const initialIconDataUrl = renderTrayIconWithTime();

	// Send rendered icon to main process
	ipcRenderer.send('update-tray-icon', initialIconDataUrl);
}

/**
 * Updates the tray icon with new time display
 * @param timeText - Formatted time string to display (e.g., "01:23:45")
 */
export async function handleTimerUpdate(timeText: string): Promise<void> {
	LAST_TIME_DISPLAY = timeText;
	if (!loadedIconImage) {
		await initializeTrayIcon();
	}
	const iconDataUrl = renderTrayIconWithTime(timeText);
	ipcRenderer.send('update-tray-icon', iconDataUrl);
}

/**
 * Handles timer stop event - switches to stopped icon and background
 */
export async function handleStopTimer(): Promise<void> {
	const TIMER_STOPPED = true;
	await loadIconImage(TIMER_STOPPED);
	renderBackgroundLayer(TIMER_STOPPED);
	const iconDataUrl = renderTrayIconWithTime(LAST_TIME_DISPLAY);
	ipcRenderer.send('update-tray-icon', iconDataUrl);
}

/**
 * Handles timer start event - switches to active icon and background
 */
export async function handleStartTimer(): Promise<void> {
	const TIMER_ACTIVE = false;

	// Re-initialize theme in case system theme changed while stopped
	initializeThemeColors();

	await loadIconImage(TIMER_ACTIVE);
	renderBackgroundLayer(TIMER_ACTIVE);
	const iconDataUrl = renderTrayIconWithTime(LAST_TIME_DISPLAY);
	ipcRenderer.send('update-tray-icon', iconDataUrl);
}

/**
 * Handles theme update event (e.g., when OS theme changes)
 * @param isTimerStopped - Current timer state
 */
function handleThemeUpdate(isTimerStopped: boolean): void {
	initializeThemeColors();
	renderBackgroundLayer(isTimerStopped);

	// Only update tray icon if timer is stopped (active timer updates continuously)
	if (isTimerStopped) {
		const iconDataUrl = renderTrayIconWithTime(LAST_TIME_DISPLAY);
		ipcRenderer.send('update-tray-icon', iconDataUrl);
	}
}

/**
 * Sets the icon file paths for active and stopped states
 * @param activeIconPath - Path to icon shown when timer is active
 * @param stoppedIconPath - Path to icon shown when timer is stopped
 */
export function setIconPaths(activeIconPath: string, stoppedIconPath: string): void {
	activeTimerIconPath = activeIconPath;
	stoppedTimerIconPath = stoppedIconPath;
}
