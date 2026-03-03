# Plugin Settings UI

A comprehensive Angular-based UI system for managing plugins in the desktop application. This module provides a complete interface for discovering, installing, configuring, and managing plugins with support for marketplace integration, subscriptions, and desktop-specific features.

## Overview

The Plugin Settings UI is a feature-rich module that bridges the gap between the backend plugin system and end users, providing:

- Plugin marketplace with search, filtering, and discovery
- Plugin installation and management (desktop only)
- Subscription and billing management
- Plugin configuration and settings
- User access control and permissions
- Analytics and monitoring
- Multi-language support

## Architecture

### Module Structure

```
plugins/
├── component/              # UI Components
│   ├── +state/            # State management (Akita)
│   ├── add-plugin/        # Plugin addition UI
│   ├── plugin-layout/     # Main layout with tabs
│   ├── plugin-list/       # Installed plugins list
│   ├── plugin-marketplace/ # Marketplace browser
│   └── plugin/            # Individual plugin view
├── domain/                # Business logic
│   ├── commands/          # Command pattern implementations
│   └── interfaces/        # Domain interfaces
├── guards/                # Route guards
├── services/              # Core services
│   ├── builders/          # Form data builders
│   ├── factories/         # Service factories
│   ├── resolvers/         # Route resolvers
│   └── strategies/        # Strategy pattern implementations
└── shared/                # Shared utilities
    └── ui/                # Reusable UI components
```

### Key Technologies

- **Angular 18+** - Component framework
- **Akita** - State management
- **@ngneat/effects** - Side effects management
- **Nebular** - UI component library
- **RxJS** - Reactive programming
- **Angular2-smart-table** - Data tables

## Core Components

### 1. PluginLayoutComponent

The main layout component that provides navigation between marketplace and installed plugins.

**Features:**

- Tab-based navigation (Discover/Installed)
- Responsive design
- Desktop-specific features detection
- Pending installation notifications

**Routes:**

- `/plugins/marketplace` - Browse available plugins
- `/plugins/installed` - Manage installed plugins (desktop only)

### 2. PluginMarketplaceComponent

Marketplace browser for discovering and installing plugins.

**Features:**

- Grid/List view modes
- Advanced filtering and search
- Infinite scroll pagination
- Plugin details modal
- Upload functionality (for authorized users)
- Real-time updates

**Filters:**

- Search by name/description
- Status (published, draft, archived)
- Type/Category
- Author
- License
- Downloads threshold
- Date range
- Featured/Verified badges

### 3. PluginListComponent

Manages locally installed plugins (desktop only).

**Features:**

- Smart table with sorting/pagination
- Plugin activation/deactivation
- Update notifications
- Uninstall functionality
- Status indicators
- Bulk operations

**Columns:**

- Name
- Status (Active/Inactive)
- Version
- Last Updated

### 4. PluginMarketplaceDetailComponent

Detailed view of a plugin with tabs for different aspects.

**Tabs:**

- Overview - Description, features, screenshots
- User Management - Access control and assignments
- Settings - Plugin configuration
- Subscriptions - Billing and plans
- Analytics - Usage statistics

## State Management

### Akita Stores

#### PluginStore

Manages installed plugins state (desktop only).

```typescript
interface IPluginState {
	activating: boolean;
	deactivating: boolean;
	plugins: IPlugin[];
	plugin: IPlugin;
}
```

**Actions:**

- `getPlugins` - Load all installed plugins
- `getPlugin` - Load specific plugin
- `activate` - Activate a plugin
- `deactivate` - Deactivate a plugin
- `selectPlugin` - Select plugin for operations
- `refresh` - Reload plugin list

#### PluginMarketplaceStore

Manages marketplace state and filters.

```typescript
interface IPluginMarketplaceState {
	plugins: IPlugin[];
	selectedPlugin: IPlugin;
	filters: IPluginFilter;
	appliedFilters: IPluginFilter;
	viewMode: 'grid' | 'list';
	showAdvancedFilters: boolean;
	loading: boolean;
	count: number;
}
```

#### PluginSubscriptionStore

Manages subscription state for plugins.

```typescript
interface IPluginSubscriptionState {
	subscriptions: IPluginSubscription[];
	currentSubscription: IPluginSubscription;
	loading: boolean;
	error: any;
}
```

### Effects

Effects handle side effects and async operations:

- **PluginEffects** - Plugin lifecycle operations
- **PluginMarketplaceEffects** - Marketplace data fetching
- **PluginInstallationEffects** - Installation/uninstallation
- **PluginSubscriptionEffects** - Subscription management
- **PluginSettingsEffects** - Configuration management

## Core Services

### PluginService

HTTP service for plugin CRUD operations.

**Key Methods:**

```typescript
getAll(params): Observable<IPagination<IPlugin>>
getOne(id, params): Observable<IPlugin>
upload(plugin): Observable<{plugin, progress}>
update(pluginId, plugin): Observable<IPlugin>
delete(id): Observable<IPlugin>
install(pluginInstallRequest): Observable<IPluginInstallation>
uninstall(pluginId, installationId, reason): Observable<void>
activate(pluginId, installationId): Observable<void>
deactivate(pluginId, installationId): Observable<void>
addVersion(pluginId, version): Observable<{version, progress}>
```

### PluginElectronService

Bridge between Angular UI and Electron main process (desktop only).

**Key Methods:**

```typescript
get isDesktop: boolean
get plugins: Promise<IPlugin[]>
plugin(name): Promise<IPlugin>
checkInstallation(marketplaceId): Promise<IPlugin>
activate(plugin): void
deactivate(plugin): void
downloadAndInstall(config): void
uninstall(input): void
completeInstallation(marketplaceId, installationId): void
progress(callback): Observable<{message, data}>
getOS(): Promise<{platform, arch}>
```

**IPC Channels:**

- `plugins::getAll` - Get all installed plugins
- `plugins::getOne` - Get specific plugin
- `plugins::check` - Check if plugin is installed
- `plugin::activate` - Activate plugin
- `plugin::deactivate` - Deactivate plugin
- `plugin::download` - Download and install plugin
- `plugin::uninstall` - Uninstall plugin
- `plugin::status` - Installation progress updates
- `plugins::get-os` - Get OS information

### PluginLoaderService

Dynamically loads Angular components/modules from plugins.

**Features:**

- Supports standalone components
- Supports NgModules
- Lazy loading with error handling
- Fallback component on errors
- Input property binding

**Usage:**

```typescript
await pluginLoaderService.load(plugin, viewContainerRef, { inputProp: value });
```

### PluginSubscriptionService

Manages plugin subscriptions and billing.

**Key Methods:**

```typescript
// Subscriptions
getCurrentSubscription(pluginId): Observable<IPluginSubscription>
getUserSubscriptions(userId?): Observable<IPluginSubscription[]>
createSubscription(subscription): Observable<IPluginSubscription>
updateSubscription(pluginId, id, subscription): Observable<IPluginSubscription>
cancelSubscription(pluginId, id, reason?): Observable<IPluginSubscription>
upgradeSubscription(pluginId, id, newPlanId): Observable<IPluginSubscription>
downgradeSubscription(pluginId, id, newPlanId): Observable<IPluginSubscription>

// Plans
getAllPlans(params): Observable<IPagination<IPluginSubscriptionPlan>>
getPluginPlans(pluginId): Observable<IPluginSubscriptionPlan[]>
createPlan(plan): Observable<IPluginSubscriptionPlan>
bulkCreatePlans(plans): Observable<IPluginSubscriptionPlan[]>

// Billing
getBillingHistory(subscriptionId): Observable<IPluginBilling[]>
retryBilling(id): Observable<IPluginBilling>
downloadInvoice(billingId): Observable<Blob>

// Payments
getPaymentHistory(subscriptionId): Observable<IPluginPayment[]>
processPayment(subscriptionId, paymentMethodId): Observable<IPluginPayment>
refundPayment(id, amount?, reason?): Observable<IPluginPayment>

// Analytics
getSubscriptionAnalytics(pluginId?): Observable<Analytics>
getSubscriptionMetrics(pluginId, subscriptionId): Observable<Metrics>

// Utilities
validatePromoCode(code, pluginId?): Observable<PromoCodeValidation>
getSubscriptionPreview(planId, promoCode?): Observable<SubscriptionPreview>
```

### Additional Services

- **PluginSettingsService** - Plugin configuration management
- **PluginSecurityService** - Security validation and checks
- **PluginAnalyticsService** - Usage tracking and analytics
- **PluginTagsService** - Tag management
- **PluginUserAssignmentService** - User access control
- **PluginCategoryService** - Category management
- **UserSubscribedPluginsService** - User subscription tracking

## Plugin Installation Flow

### Desktop Installation

1. **Discovery** - User browses marketplace
2. **Selection** - User selects plugin and version
3. **Subscription** (if required) - User subscribes to plan
4. **Download** - Plugin downloaded via CDN/npm/local
5. **Validation** - Security checks and manifest validation
6. **Installation** - Plugin extracted and registered
7. **Activation** - Plugin activated and initialized
8. **Completion** - Installation ID synced with server

### Web Installation

1. **Discovery** - User browses marketplace
2. **Selection** - User selects plugin
3. **Subscription** - User subscribes to plan
4. **Server Registration** - Installation recorded on server
5. **Access Granted** - User can access plugin features

## Subscription System

### Subscription Types

- **FREE** - No cost, limited features
- **TRIAL** - Time-limited full access
- **BASIC** - Entry-level paid plan
- **PREMIUM** - Advanced features
- **ENTERPRISE** - Full features with support
- **CUSTOM** - Negotiated pricing

### Billing Periods

- DAILY
- WEEKLY
- MONTHLY
- QUARTERLY
- YEARLY
- ONE_TIME

### Subscription Status

- **ACTIVE** - Currently active
- **TRIAL** - In trial period
- **CANCELLED** - Cancelled by user
- **EXPIRED** - Subscription ended
- **PAST_DUE** - Payment failed
- **SUSPENDED** - Temporarily disabled
- **PENDING** - Awaiting activation

### Subscription Scopes

- **USER** - Individual user subscription
- **ORGANIZATION** - Organization-wide access
- **TEAM** - Team-level access

## User Interface Features

### Marketplace Features

- **Search** - Full-text search across plugins
- **Filters** - Multi-criteria filtering
- **Sorting** - By name, downloads, rating, date
- **View Modes** - Grid or list view
- **Infinite Scroll** - Load more on scroll
- **Plugin Cards** - Rich preview cards
- **Quick Actions** - Install, subscribe, view details

### Plugin Management Features

- **Status Toggle** - Activate/deactivate plugins
- **Update Notifications** - Version update alerts
- **Uninstall** - Remove plugins with confirmation
- **Configuration** - Plugin-specific settings
- **Logs** - View plugin logs and errors
- **Permissions** - Manage plugin permissions

### Subscription Management Features

- **Plan Selection** - Compare and select plans
- **Billing Forms** - Payment method management
- **Invoice History** - Download invoices
- **Usage Metrics** - Track usage against limits
- **Upgrade/Downgrade** - Change plans
- **Cancellation** - Cancel with reason

## Security Features

### Access Control

- **Route Guards** - Protect sensitive routes
- **Permission Checks** - Verify user permissions
- **Role-Based Access** - Admin/user/viewer roles
- **Subscription Validation** - Check active subscriptions

### Plugin Security

- **Signature Verification** - Verify plugin authenticity
- **Manifest Validation** - Validate plugin metadata
- **Sandbox Execution** - Isolated plugin execution
- **Permission System** - Granular permissions

## Responsive Design

The UI is fully responsive with:

- **Mobile-first** - Optimized for mobile devices
- **Tablet Support** - Adapted layouts for tablets
- **Desktop Optimization** - Full features on desktop
- **Adaptive Filters** - Collapsible on mobile
- **Touch-friendly** - Large touch targets

## Internationalization

Full i18n support using ngx-translate:

- **Multi-language** - Support for multiple languages
- **Dynamic Translation** - Runtime language switching
- **Locale Formatting** - Date, number, currency formatting
- **RTL Support** - Right-to-left language support

## Error Handling

Comprehensive error handling:

- **Toast Notifications** - User-friendly error messages
- **Fallback Components** - Graceful degradation
- **Retry Logic** - Automatic retry on failures
- **Error Logging** - Detailed error logs
- **User Guidance** - Helpful error messages

## Performance Optimization

- **Lazy Loading** - Load components on demand
- **Virtual Scrolling** - Efficient list rendering
- **Change Detection** - OnPush strategy
- **Memoization** - Cache expensive computations
- **Debouncing** - Reduce API calls
- **Pagination** - Load data in chunks

## Usage Examples

### Browse Marketplace

```typescript
// Navigate to marketplace
router.navigate(['/plugins/marketplace']);

// Apply filters
action.dispatch(
	PluginMarketplaceActions.setFilters({
		search: 'analytics',
		types: ['productivity'],
		verified: true
	})
);
```

### Install Plugin (Desktop)

```typescript
// Download and install
pluginElectronService.downloadAndInstall({
	contextType: PluginDownloadContextType.CDN,
	url: 'https://cdn.example.com/plugin.zip',
	marketplaceId: 'plugin-id',
	versionId: 'version-id'
});

// Monitor progress
pluginElectronService
	.progress((message) => {
		console.log('Progress:', message);
	})
	.subscribe({
		next: (result) => console.log('Installed:', result),
		error: (error) => console.error('Failed:', error)
	});
```

### Subscribe to Plugin

```typescript
// Create subscription
pluginSubscriptionService
	.createSubscription({
		pluginId: 'plugin-id',
		planId: 'plan-id',
		scope: PluginScope.USER,
		autoRenew: true,
		paymentMethodId: 'payment-method-id'
	})
	.subscribe({
		next: (subscription) => console.log('Subscribed:', subscription),
		error: (error) => console.error('Failed:', error)
	});
```

### Manage Plugin

```typescript
// Activate plugin
action.dispatch(PluginActions.activate(plugin));

// Deactivate plugin
action.dispatch(PluginActions.deactivate(plugin));

// Uninstall plugin
action.dispatch(PluginInstallationActions.uninstall(plugin.marketplaceId, plugin.id));
```

### Load Plugin Component

```typescript
// Load plugin UI component
const componentRef = await pluginLoaderService.load(plugin, viewContainerRef, { config: pluginConfig });

// Access component instance
componentRef.instance.someMethod();
```

## Testing

The module includes comprehensive testing:

- **Unit Tests** - Service and component tests
- **Integration Tests** - End-to-end workflows
- **Mock Services** - Test doubles for dependencies
- **Fixture Data** - Realistic test data

## Best Practices

1. **Always check `isDesktop`** before using Electron features
2. **Handle errors gracefully** with user-friendly messages
3. **Use state management** for complex data flows
4. **Implement loading states** for async operations
5. **Validate user input** before API calls
6. **Clean up subscriptions** in ngOnDestroy
7. **Use type safety** with TypeScript interfaces
8. **Follow Angular style guide** for consistency
9. **Optimize change detection** with OnPush
10. **Test thoroughly** before deployment

## Future Enhancements

- Plugin ratings and reviews
- Plugin recommendations
- Social sharing features
- Plugin collections/bundles
- Advanced analytics dashboard
- Plugin dependency visualization
- Automated testing framework
- Plugin marketplace API
- Webhook integrations
- Custom plugin templates
