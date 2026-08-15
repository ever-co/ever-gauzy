# Changelog for @gauzy/ui-react-components

## [Unreleased]

### Added

- `themeTokens` / `statusColor()` — theme-adaptive CSS custom-property tokens (light/dark aware) for React surfaces mounted inside the Gauzy shell.
- Theme-adaptive Nebular ports: `CounterPoint` (+ `computeCounterPoints`, `counterPointBackground`), `ProgressBar`, `Badge`, `Avatar`, `Spinner`, `Popover` (+ `computePopoverPosition`).
- Helpers: `progressStatus()`, `ensureStyleTag()` / `useInjectedStyles()`.

### Changed

- README rewritten to describe the real exports (it referenced `StatCard` / `ProgressBar` / `ProjectDots` / `pad` which never existed).
- `theme` (hardcoded light hexes) is now documented as legacy; new work should use `themeTokens`.
