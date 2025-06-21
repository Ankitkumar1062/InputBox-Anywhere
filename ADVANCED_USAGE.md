
# Advanced Usage for Floating Input Box Extension

## Handling Long Content Pages

When using the Advanced Mode on pages with extensive content, please note:

### Content Selection Strategy

To get the best results with TinyLlama's limited context window:

1. **Select Specific Sections**: Instead of processing the entire page, try selecting specific sections of text before activating Advanced Mode. This helps focus the model on the most relevant content.

2. **Use the Browser's Selection Tool**:
   - Highlight the most important paragraphs on the page
   - Right-click and select "Process Selected Text" from the context menu
   - This will only send the selected text to the model

3. **Progressive Processing**:
   - For very long articles, process one section at a time
   - This gives more targeted and coherent results than trying to process the entire page

### Optimizing for Different Content Types

- **For Articles**: Focus on selecting the introduction and conclusion
- **For Documentation**: Select specific sections rather than the entire document
- **For Code-heavy pages**: Use Advanced Mode with the "CSS Suggestions" option which requires less context

### Keyboard Shortcuts for Efficient Use

- `Ctrl+Shift+F`: Toggle floating input box
- `Ctrl+Shift+A`: Toggle Advanced Mode
- `Ctrl+Shift+S`: Process selected text only (when text is highlighted)

### Server Resource Management

If you're running the local TinyLlama server on a resource-constrained machine:

1. Set the environment variable `LLAMA_NUM_THREADS` before starting the server to control CPU usage
2. For better performance, consider upgrading to a larger model with a bigger context window
