# @gauzy/ui-react-bridge

Bridge for rendering React components inside Angular with access to Angular services via React Context.

Uses the React Context + `createRoot` approach to embed React in Angular (see [Netanel Basal's article](https://netbasal.com/using-react-in-angular-applications-1bb907ecac91) for the underlying technique).

## Installation

```bash
yarn add react react-dom
# @gauzy/ui-react-bridge is a workspace package
```

## Quick Start

### Option 1: Using with Plugin UI Bridge System (Recommended)

The UI Bridge system provides a unified way to render React components across the plugin ecosystem.

#### 1. Register the React Bridge

```typescript
// In your app.config.ts or main.ts
import { provideReactBridge } from '@gauzy/ui-react-bridge';

export const appConfig: ApplicationConfig = {
  providers: [
    provideReactBridge(),
    // ... other providers
  ]
};
```

#### 2. Use FrameworkHostComponent

```typescript
import { Component } from '@angular/core';
import { FrameworkHostComponent } from '@gauzy/plugin-ui';
import { MyReactWidget } from './react/MyReactWidget';

@Component({
  imports: [FrameworkHostComponent],
  template: `
    <gz-framework-host
      frameworkId="react"
      [component]="widget"
      [props]="{ title: 'Hello!' }"
    />
  `
})
export class MyComponent {
  widget = MyReactWidget;
}
```

#### 3. Define React Extensions in Plugins

```typescript
import { 
  defineFrameworkExtension, 
  UI_BRIDGE_FRAMEWORK, 
  EXTENSION_SLOTS 
} from '@gauzy/plugin-ui';
import { MyReactWidget } from './react/MyReactWidget';

export const MyPlugin: PluginUiDefinition = {
  id: 'my-plugin',
  module: MyPluginModule,
  extensions: [
    defineFrameworkExtension({
      id: 'my-react-widget',
      slotId: EXTENSION_SLOTS.DASHBOARD_WIDGETS,
      frameworkId: UI_BRIDGE_FRAMEWORK.REACT,
      frameworkComponent: MyReactWidget,
      frameworkProps: { title: 'Dashboard Widget' }
    })
  ]
};
```

---

### Option 2: Using Directives Directly

For simpler use cases, you can use the React directives directly without the bridge system.

#### 1. Import directives in your Angular module

```ts
import { ReactHostDirective, LazyReactHostDirective } from '@gauzy/ui-react-bridge';

@NgModule({
  imports: [ReactHostDirective, LazyReactHostDirective, ...],
})
export class AppModule {}
```

#### 2. Render a React component (eager)

```html
<div [gzReactHost]="MyReactComponent" [props]="props"></div>
```

With extra context:

```html
<div [gzReactHost]="KanbanBoard" [props]="props" [context]="{ pageTitle: 'Kanban' }"></div>
```

#### 3. Render a React component (lazy / code-split)

```html
<div [gzReactLazyHost]="loadKanban" [props]="kanbanProps" [context]="{ pageTitle: 'Kanban' }"></div>
```

```ts
loadKanban = () => import('./kanban/KanbanBoard').then((m) => m);
kanbanProps = { columns: this.columns };
```

---

## Accessing Angular Services in React

### Using useInjector Hook

```tsx
import { useInjector } from '@gauzy/ui-react-bridge';
import { Router } from '@angular/router';

export function MyReactComponent() {
  const router = useInjector(Router);
  return <button onClick={() => router.navigate(['/home'])}>Go Home</button>;
}
```

Or get the Injector for multiple lookups:

```tsx
const injector = useInjector();
const router = injector.get(Router);
const http = injector.get(HttpClient);
```

### Using useBridgeContext Hook

Access both the injector and any extra context passed from Angular:

```tsx
import { useBridgeContext } from '@gauzy/ui-react-bridge';

export function MyReactComponent() {
  const { injector, pageTitle } = useBridgeContext();
  // pageTitle came from [context]="{ pageTitle: 'Kanban' }"
  return <h1>{pageTitle}</h1>;
}
```

---

## API Reference

### Core Exports

| Export | Description |
|--------|-------------|
| `ReactHostDirective` | Directive `[gzReactHost]` – eager render |
| `LazyReactHostDirective` | Directive `[gzReactLazyHost]` – lazy render via dynamic import |
| `useInjector()` | Returns Angular `Injector` |
| `useInjector(MyService)` | Returns injected service |
| `useBridgeContext()` | Returns full context (injector + extra context) |
| `NgContextProvider` | React context provider (used internally) |
| `NgReactBridgeContext` | Context type |

### Bridge System Exports

| Export | Description |
|--------|-------------|
| `ReactBridge` | UiBridge implementation for React |
| `provideReactBridge()` | Registers ReactBridge via APP_INITIALIZER |
| `createReactBridge()` | Factory to create ReactBridge instance |

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Angular Application             │
│  ┌───────────────────────────────────┐  │
│  │    FrameworkHostComponent or      │  │
│  │    ReactHostDirective             │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │    NgContextProvider        │  │  │
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │   React Component     │  │  │  │
│  │  │  │   - useInjector()     │  │  │  │
│  │  │  │   - useBridgeContext()│  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## License

AGPL-3.0
