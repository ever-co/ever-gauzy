import { MenuItemConstructorOptions } from 'electron';
import { MenuCommand } from '../commands';

/**
 * Fluent builder for creating menu items with commands
 */
export class MenuItemBuilder {
	private item: Partial<MenuItemConstructorOptions> = {};

	withId(id: string): this {
		this.item.id = id;
		return this;
	}

	withLabel(label: string): this {
		this.item.label = label;
		return this;
	}

	withAccelerator(accelerator: string): this {
		this.item.accelerator = accelerator;
		return this;
	}

	withCommand(command: MenuCommand): this {
		this.item.click = async () => {
			try {
				await command.execute();
			} catch (error) {
				console.error(`[MenuItemBuilder] Command execution failed:`, error);
			}
		};
		return this;
	}

	withEnabled(enabled: boolean): this {
		this.item.enabled = enabled;
		return this;
	}

	withVisible(visible: boolean): this {
		this.item.visible = visible;
		return this;
	}

	asSeparator(): this {
		this.item.type = 'separator';
		return this;
	}

	build(): MenuItemConstructorOptions {
		return this.item as MenuItemConstructorOptions;
	}
}
