# Change Log

All notable changes to the "magicdata-intellisense" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.0] - 2026-08-31

### Fixed
- **Attribute Auto-Completion:** Fixed auto-completion behavior inside the `Name` attribute quotes within `Action` tags.
- **Self-Closing Tags:** Corrected XML tag formatting to enforce self-closing syntax on designated single-tag elements.

### Refactored
- **Dynamic Data Source:** Replaced hardcoded configuration logic with dynamic parsing directly from `MDLang.xml`.
- **Code Architecture:** Modularized codebase across multiple files and extracted inline strings into dedicated constants.