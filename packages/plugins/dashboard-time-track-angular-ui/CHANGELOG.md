# Changelog for @gauzy/plugin-dashboard-time-track-angular-ui

## [0.1.0] - 2026-03-15

### Added
- Initial release of the Dashboard Time Tracking Angular UI plugin.
- Extracted the time-tracking dashboard tab from the monolithic dashboard module into a standalone plugin package.
- Implemented lazy loading for the plugin module using `loadChildren` and `defineDeclarativePlugin`.
- Registered `time-tracking` route under `page-sections`.
- Added a "Time Tracking" tab to the `dashboard-page` tabset with proper permissions and icons.
- Integrated comprehensive i18n support with 13 languages.
- Moved `DateRangePickerResolver` and `BookmarkQueryParamsResolver` to the component route level for improved data resolving.
- Added build scripts and automated copying of the package in Docker configurations.
