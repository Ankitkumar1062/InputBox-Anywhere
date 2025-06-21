# Floating Input Box Extension

## Description
The Floating Input Box Extension enhances your browsing experience by providing a customizable, floating input box. This extension supports various modes, including a "Habit Mode" for quick text input and an "Advanced Mode" that integrates with a local Large Language Model (LLM) server for advanced functionalities like page summarization and CSS customization. The floating box can also be made draggable for flexible positioning on any webpage.

## Features
*   **Toggle Extension**: Easily enable or disable the floating input box.
*   **Habit Mode**: A simple floating input box that appears when you focus on text fields.
*   **Advanced Mode**:
    *   **Page Summarization**: Summarize selected text, main content, or the entire page using a local LLM server.
    *   **CSS Customization**: Apply preset CSS styles (Readability, Dark Mode, Large Text, Minimal UI) or write and apply your own custom CSS to any webpage.
    *   **Draggable Box**: Move the custom input box freely around the screen when in Advanced Mode.
*   **Customizable Appearance**: Personalize the floating input box's theme, size, opacity, and more.
*   **Keyboard Shortcuts**: Quick access to common features.

## Installation and Setup

### 1. Extension Installation (Chrome/Brave/Edge)
1.  **Download/Clone**: Download or clone this repository to your local machine.
2.  **Open Extensions**: Open your browser and navigate to the Extensions page.
    *   For Chrome: Type `chrome://extensions` in the address bar.
    *   For Brave: Type `brave://extensions` in the address bar.
    *   For Edge: Type `edge://extensions` in the address bar.
3.  **Enable Developer Mode**: Toggle on "Developer mode" (usually in the top right corner).
4.  **Load Unpacked**: Click on the "Load unpacked" button.
5.  **Select Folder**: Navigate to the directory where you downloaded/cloned this repository (`InputBox-Anywhere/`) and select it.
6.  **Pin Extension**: The extension should now be loaded. It's recommended to pin it to your browser's toolbar for easy access.

### 2. Server Setup (for Advanced Features)
Advanced features like summarization and CSS generation require a local LLM server to be running. Follow these steps to set it up:

1.  **Navigate to the Server Directory**:
    ```bash
    cd server
    ```
2.  **Download the LLM Model**: Download the TinyLlama GGUF model. This may take some time depending on your internet connection.
    ```bash
    wget https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
    ```
3.  **Set up Python Virtual Environment and Install Dependencies**:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install fastapi uvicorn llama-cpp-python
    ```
4.  **Run the Server**:
    ```bash
    python app.py
    ```
    The server should start on `http://localhost:8000`. You will see messages indicating that the server is running. Keep this terminal window open as long as you want to use Advanced Mode features.

## Usage

1.  **Toggle Extension**: Click the extension icon in your browser toolbar to open the popup. Use the "Enable Extension" toggle to turn it on/off.
2.  **Select Mode**:
    *   **Habit Mode**: The floating input box will appear automatically when you focus on any text input field on a webpage.
    *   **Advanced Mode**: Select this option to access LLM-powered tools and customization.
3.  **Floating Box Option**: In Advanced Mode, check the "Floating Box" option to make the input box draggable.
4.  **Summarization**: In Advanced Mode, use the "Page Summarization" tool to summarize content.
5.  **CSS Customization**: In Advanced Mode, use the "CSS Customization" tool to apply presets or edit custom CSS.

## Keyboard Shortcuts
*   `Ctrl+Shift+F`: Toggle floating input box
*   `Ctrl+Shift+A`: Toggle Advanced Mode
*   `Ctrl+Shift+S`: Quick summarize (applies to selected text if available, otherwise main content)
*   `Ctrl+Shift+C`: View/edit CSS 