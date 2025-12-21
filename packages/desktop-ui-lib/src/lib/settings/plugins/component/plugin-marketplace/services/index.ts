/**
 * Plugin Installation Services
 *
 * This module provides a SOLID-based architecture for plugin installation:
 *
 * Design Patterns Used:
 * - Strategy Pattern: Different strategies for free vs subscription-based plugins
 * - Facade Pattern: Simplified interface for complex installation logic
 * - Chain of Responsibility: Validation chain for installation prerequisites
 * - Builder Pattern: Building validation chains
 * - Guard Pattern: Access verification before operations
 *
 * SOLID Principles:
 * - Single Responsibility: Each class has one clear responsibility
 * - Open/Closed: New strategies/validators can be added without modifying existing code
 * - Liskov Substitution: All strategies implement the same interface
 * - Interface Segregation: Focused, minimal interfaces
 * - Dependency Inversion: Depends on abstractions, not concrete implementations
 */

// Interfaces and abstracts
export * from './installation-validator.abstract';
export * from './plugin-installation-strategy.interface';

// Strategies
export * from './free-plugin-installation.strategy';
export * from './subscription-plugin-installation.strategy';

// Validators
export * from './validators/access.validator';
export * from './validators/plugin-status.validator';
export * from './validators/subscription.validator';

// Facades and Builders
export * from './installation-validation-chain.builder';
export * from './plugin-installation.context';

// Guards
export * from './plugin-access.guard';
