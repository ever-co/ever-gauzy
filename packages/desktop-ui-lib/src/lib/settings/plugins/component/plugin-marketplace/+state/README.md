# Plugin Subscription State Management

This directory contains the complete state management system for plugin subscription functionality using Akita and @ngneat/effects.

## Architecture Overview

The subscription-before-installation flow is implemented with the following components:

### State Management
- **Store** (`plugin-subscription.store.ts`): Manages subscription/plan state with Akita
- **Query** (`plugin-subscription.query.ts`): Provides reactive selectors and computed observables
- **Actions** (`plugin-subscription.action.ts`): Action creators using @ngneat/effects createAction pattern
- **Effects** (`plugin-subscription.effect.ts`): Handles async operations and side effects
- **Facade** (`plugin-subscription.facade.ts`): Simplified API for components

### API Integration
- Backend endpoints: `/plugins/:pluginId/subscriptions` (NestJS CQRS pattern)
- Service layer: `PluginSubscriptionService` with proper error handling
- Real-time state updates with loading indicators and error states

### UI Components
- **PluginSubscriptionSelectionComponent**: Modal dialog for plan selection
- Integrated with existing plugin detail components
- Responsive design with Nebular UI components

## Usage

### 1. Loading Plans and Subscriptions
```typescript
// Load available plans for a plugin
this.facade.loadPluginPlans(pluginId);

// Load existing subscriptions
this.facade.loadPluginSubscriptions(pluginId);
```

### 2. Creating Subscriptions
```typescript
// Show subscription dialog
this.facade.showSubscriptionDialog(pluginId);

// Create subscription after plan selection
this.facade.createSubscription(pluginId, subscriptionData);
```

### 3. Managing Subscriptions
```typescript
// Update subscription
this.facade.updateSubscription(pluginId, subscriptionId, updates);

// Cancel subscription
this.facade.cancelSubscription(pluginId, subscriptionId);
```

### 4. Reactive State Access
```typescript
// Observable streams
plans$ = this.facade.plans$;
subscriptions$ = this.facade.subscriptions$;
loading$ = this.facade.loading$;
error$ = this.facade.error$;

// Current selections
selectedPlan$ = this.facade.selectedPlan$;
selectedSubscription$ = this.facade.selectedSubscription$;
```

## State Shape

```typescript
interface PluginSubscriptionState {
  subscriptions: IPluginSubscription[];
  plans: IPluginSubscriptionPlan[];
  selectedSubscription: IPluginSubscription | null;
  selectedPlan: IPluginSubscriptionPlan | null;
  analytics: IPluginSubscriptionAnalytics | null;
  showSubscriptionDialog: boolean;
  selectedPluginId: string | null;
  loading: boolean;
  creating: boolean;
  updating: boolean;
  error: string | null;
}
```

## Features

### Subscription Flow
1. User clicks "Install Plugin" button
2. System checks for required subscription
3. Shows subscription dialog with available plans
4. User selects plan and completes subscription
5. System proceeds with plugin installation

### Error Handling
- Network error recovery
- User-friendly error messages
- Toast notifications for all operations
- Loading states for better UX

### Analytics
- Subscription usage tracking
- Plan performance metrics
- Revenue analytics

## Integration Points

- **Plugin Marketplace**: Main integration point for subscription flow
- **Plugin Detail Component**: Shows subscription status and management
- **Installation Service**: Checks subscription before installation
- **Backend API**: NestJS controllers with CQRS pattern

## Development Notes

- Uses @ngneat/effects pattern (not NgRx)
- Akita store with proper typing alignment
- Error handling with `setErrorMessage` method
- Reactive programming with RxJS observables
- Internationalization ready with TranslateService
