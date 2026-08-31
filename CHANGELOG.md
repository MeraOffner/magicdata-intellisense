# Change Log

All notable changes to the "magicdata-intellisense" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.0] - 2026-08-31

### Added
- **Dynamic Hover Documentation:** Integrated a `HoverProvider` that dynamically fetches and displays element and action `Hint` descriptions directly from `MDLang.xml` on hover.
- **Type-Based Number Auto-Completion:** Added predefined numeric suggestions for attributes defined as `AType="Number"` in the XML schema.

### Fixed
- **Attribute Auto-Completion:** Fixed auto-completion behavior inside `Name` attribute quotes within `<ACTION>` tags.
- **Self-Closing Tags:** Corrected XML tag formatting to enforce self-closing syntax on designated single-tag elements based on schema rules.
- **Suppressed Text/Word Noise:** Blocked VS Code's default word-based suggestions and inappropriate math expressions from appearing inside standard text attribute quotes (e.g., `Alias=""`, `Name=""`).

### Refactored
- **100% Schema-Driven Typing:** Replaced all hardcoded attribute name/type checks with dynamic checks matching `AType`, `Enum` lists, and `AutoCompleteExpression` values from `MDLang.xml`.
- **Code Architecture:** Modularized codebase into dedicated providers, services, and commands while centralizing constants and configuration values.