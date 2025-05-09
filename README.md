# Content Text Direction

A Chrome extension that allows you to easily apply RTL (right-to-left) text direction to specific elements on any webpage.

## Features

- **Element-Specific RTL**: Apply right-to-left text direction to specific elements rather than entire pages
- **Domain-Based Settings**: Settings are saved per domain and automatically applied when you revisit websites
- **Simple Selection**: Just click the "Add" button and select any element on the page to apply RTL
- **Easy Management**: View and remove saved elements/domains through a clean interface
- **Instant Updates**: Changes take effect immediately, including when removing RTL settings

## How to Use

1. **Navigate to any website** where you want to change text direction
2. **Click the extension icon** in your browser toolbar
3. **Click "Add"** and select the element you want to convert to RTL
4. The selected element will immediately change to RTL text direction
5. Settings are saved per domain and automatically applied when you revisit the site
6. To remove RTL settings for a domain, click the "×" button next to the domain in the popup

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and ready to use

## Technical Details

- Built with vanilla JavaScript
- Uses Chrome Extension Manifest V3
- Stores settings in Chrome's local storage
- Applies styles via direct DOM manipulation

## Privacy

This extension:
- Does not collect any user data
- Does not send any information to remote servers
- Only stores domain names and CSS selectors locally on your device

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
