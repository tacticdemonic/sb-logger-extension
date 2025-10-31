# Contributing to SB Logger

Thank you for your interest in contributing to SB Logger! This document provides guidelines for contributing to the project.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue on GitHub with:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Browser version and OS
- Screenshots if applicable

### Suggesting Enhancements

Enhancement suggestions are welcome! Please open an issue with:
- A clear description of the enhancement
- Use cases and benefits
- Any implementation ideas you have

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** with clear, descriptive commits
3. **Test thoroughly** in multiple browsers (Chrome, Firefox, Edge)
4. **Update documentation** if you're changing functionality
5. **Submit a pull request** with a clear description of your changes

#### Pull Request Guidelines

- Keep changes focused - one feature or fix per PR
- Follow the existing code style and conventions
- Add comments for complex logic
- Test your changes with real bet data from surebet.com
- Ensure all existing functionality still works

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/sb-logger-extension.git
   cd sb-logger-extension
   ```

2. Load the extension in your browser:
   - **Chrome/Edge/Brave**: Navigate to `chrome://extensions/`, enable Developer mode, click "Load unpacked"
   - **Firefox**: Navigate to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on"

3. Make your changes and reload the extension to test

## Code Style

- Use clear, descriptive variable and function names
- Add JSDoc comments for functions
- Use ES6+ features (const/let, arrow functions, template literals)
- Keep functions small and focused
- Handle errors gracefully with try/catch

## Testing

Before submitting a PR:
1. Test on surebet.com/valuebets with real data
2. Test the save button injection
3. Test bet settlement (Won/Lost/Void)
4. Test export functionality (JSON/CSV)
5. Test the P/L chart
6. Verify the extension works in Chrome and Firefox
7. Check browser console for errors

## Areas for Contribution

We welcome contributions in these areas:

### High Priority
- Additional sports API integrations for auto-checking results
- Support for more bet types and markets
- Improved bet matching algorithms
- Performance optimizations for large bet lists
- Mobile browser compatibility

### Medium Priority
- Additional export formats (Excel, Google Sheets)
- Advanced filtering and search in popup
- Statistics and analytics features
- Dark mode support
- Localization/translations

### Documentation
- Tutorial videos or GIFs
- More detailed troubleshooting guides
- API setup guides for additional sports data providers

## Questions?

If you have questions about contributing, feel free to:
- Open an issue labeled "question"
- Check existing issues and discussions
- Review the README and documentation

## Code of Conduct

- Be respectful and constructive in all interactions
- Focus on the code and ideas, not the person
- Help create a welcoming environment for all contributors

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
