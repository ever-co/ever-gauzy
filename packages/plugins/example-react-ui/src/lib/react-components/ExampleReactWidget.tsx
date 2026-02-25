import { useState, useEffect } from 'react';
import { useInjector } from '@gauzy/ui-react-bridge';
import { Router } from '@angular/router';
import { Card, Flex, Text, Button, Badge, Code, Heading, Box, IconButton } from '@radix-ui/themes';
import { MinusIcon, PlusIcon, RocketIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import { RadixThemeProvider } from './RadixThemeProvider';

/**
 * Props for the ExampleReactWidget component.
 */
export interface ExampleReactWidgetProps {
	title?: string;
	description?: string;
}

/**
 * Example React widget using Radix UI Themes that demonstrates:
 * 1. Basic React component rendering in Angular
 * 2. Using Angular services via useInjector()
 * 3. React state management (useState, useEffect)
 * 4. Radix UI Themes components (Card, Button, Badge, etc.)
 */
export function ExampleReactWidget({ title = 'React Widget', description }: ExampleReactWidgetProps) {
	const [count, setCount] = useState(0);
	const [currentRoute, setCurrentRoute] = useState<string>('');

	// Access Angular Router service from React
	const router = useInjector(Router);

	useEffect(() => {
		// Get current route from Angular Router
		setCurrentRoute(router.url);
	}, [router]);

	const handleNavigate = () => {
		// Navigate using Angular Router from React
		router.navigate(['/pages/dashboard']);
	};

	return (
		<RadixThemeProvider appearance="light" accentColor="blue">
			<Card size="3">
				<Flex direction="column" gap="4">
					{/* Header */}
					<Flex align="center" gap="2">
						<RocketIcon width="20" height="20" />
						<Heading size="4">{title}</Heading>
						<Badge color="blue" variant="soft">
							React
						</Badge>
					</Flex>

					{/* Description */}
					{description && (
						<Text as="p" size="2" color="gray">
							{description}
						</Text>
					)}

					{/* Current Route */}
					<Box>
						<Text as="p" size="2" color="gray">
							Current Angular Route: <Code>{currentRoute}</Code>
						</Text>
					</Box>

					{/* Counter */}
					<Flex align="center" gap="3">
						<IconButton
							size="3"
							color="red"
							variant="soft"
							onClick={() => setCount((c) => c - 1)}
						>
							<MinusIcon width="18" height="18" />
						</IconButton>

						<Text size="6" weight="bold" style={{ minWidth: '60px', textAlign: 'center' }}>
							{count}
						</Text>

						<IconButton
							size="3"
							color="green"
							variant="soft"
							onClick={() => setCount((c) => c + 1)}
						>
							<PlusIcon width="18" height="18" />
						</IconButton>
					</Flex>

					{/* Navigation Button */}
					<Button size="2" onClick={handleNavigate}>
						Navigate to Dashboard (via Angular Router)
					</Button>

					{/* Footer */}
					<Flex align="center" gap="1">
						<CheckCircledIcon color="green" />
						<Text size="1" color="gray">
							This React component is rendered inside Angular using @gauzy/ui-react-bridge
						</Text>
					</Flex>
				</Flex>
			</Card>
		</RadixThemeProvider>
	);
}

export default ExampleReactWidget;
