# Changelog for @gauzy/plugin-dashboard-time-track-react-ui

## [0.1.0] - 2026-03-15

### Added

- Initial release of the Dashboard Time Tracking React UI plugin.
- Ported time-tracking dashboard widgets (Members worked, Projects worked, Today's Activity, Worked today, Worked this week, Weekly Activity) to React.
- Implemented live data fetching via the Angular injector bridge using `TimesheetStatisticsService`.
- Integrated `DashboardRefreshedEvent` and `WidgetVisibilityChangedEvent` for real-time updates.
- Added auto-generated settings UI for toggling widget visibility.
- Registered `react-time-tracking` route and tab under `dashboard-page`.

