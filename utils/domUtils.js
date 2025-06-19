/**
 * DOM utilities for Custom Input Box Everywhere
 * Last updated: 2025-06-18 12:47:57
 * Author: Ankitkumar1062
 */

// Create an element with attributes and children
function createElement(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  
  // Set attributes
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key === 'classList' && Array.isArray(value)) {
      element.classList.add(...value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(element.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.substr(2).toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  }
  
  // Add children
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }
  
  return element;
}

// Get the current active input element
function getActiveInputElement() {
  const activeElement = document.activeElement;
  const isInputElement = (
    activeElement.tagName === 'INPUT' && 
    ['text', 'email', 'password', 'search', 'tel', 'url'].includes(activeElement.type)
  ) || 
    activeElement.tagName === 'TEXTAREA' || 
    activeElement.isContentEditable;
  
  return isInputElement ? activeElement : null;
}

// Get the position of an element relative to the viewport
function getElementPosition(element) {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom + window.scrollY,
    right: rect.right + window.scrollX
  };
}

// Create a tooltip
function createTooltip(message, position, duration = 3000) {
  // Check if a tooltip already exists and remove it
  const existingTooltip = document.querySelector('.cib-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
  
  const tooltip = createElement('div', {
    classList: ['cib-tooltip'],
    style: {
      position: 'fixed',
      zIndex: '10000',
      padding: '8px 12px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#fff',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: '500',
      pointerEvents: 'none',
      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
      opacity: '0',
      transition: 'opacity 0.3s'
    }
  }, [message]);
  
  document.body.appendChild(tooltip);
  
  // Position the tooltip
  const tooltipRect = tooltip.getBoundingClientRect();
  
  if (position === 'top') {
    tooltip.style.top = '10px';
  } else if (position === 'bottom') {
    tooltip.style.bottom = '10px';
  } else {
    tooltip.style.top = '10px';
  }
  
  tooltip.style.left = `${(window.innerWidth - tooltipRect.width) / 2}px`;
  
  // Make visible with a slight delay
  setTimeout(() => {
    tooltip.style.opacity = '1';
  }, 50);
  
  // Remove after duration
  setTimeout(() => {
    tooltip.style.opacity = '0';
    setTimeout(() => {
      tooltip.remove();
    }, 300);
  }, duration);
  
  return tooltip;
}

// Apply CSS to the page
function applyCustomCSS(css) {
  // Check if custom style element exists already
  let styleElement = document.getElementById('custom-input-box-css');
  
  if (!styleElement) {
    styleElement = createElement('style', {
      id: 'custom-input-box-css',
      type: 'text/css'
    });
    document.head.appendChild(styleElement);
  }
  
  try {
    // First try using styleSheet.cssText for IE
    styleElement.styleSheet.cssText = css;
  } catch (e) {
    // For everyone else
    styleElement.textContent = css;
  }
  
  return true;
}

// Get the basic structure of the page for CSS generation
function getPageStructure() {
  const url = window.location.href;
  const title = document.title;
  const elements = [];
  
  // Get common elements
  const mainElement = document.querySelector('main');
  const contentElements = document.querySelectorAll('article, .content, #content, [role="main"]');
  const formElements = document.querySelectorAll('form');
  const inputElements = document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
  
  // Collect main element info
  if (mainElement) {
    elements.push({
      id: mainElement.id || null,
      tagName: mainElement.tagName.toLowerCase(),
      className: mainElement.className,
      role: mainElement.getAttribute('role'),
      type: 'main content'
    });
  }
  
  // Collect content elements info
  if (contentElements.length > 0) {
    Array.from(contentElements).slice(0, 3).forEach((el, index) => {
      elements.push({
        id: el.id || null,
        tagName: el.tagName.toLowerCase(),
        className: el.className,
        role: el.getAttribute('role'),
        type: 'content area ' + index
      });
    });
  }
  
  // Collect form elements info
  if (formElements.length > 0) {
    Array.from(formElements).slice(0, 2).forEach((el, index) => {
      elements.push({
        id: el.id || null,
        tagName: el.tagName.toLowerCase(),
        className: el.className,
        action: el.getAttribute('action'),
        type: 'form ' + index
      });
    });
  }
  
  // Collect input elements info
  if (inputElements.length > 0) {
    Array.from(inputElements).slice(0, 5).forEach((el, index) => {
      elements.push({
        id: el.id || null,
        tagName: el.tagName.toLowerCase(),
        className: el.className,
        placeholder: el.getAttribute('placeholder'),
        type: 'input ' + index
      });
    });
  }
  
  return {
    url,
    title,
    elements
  };
}

// Safely execute a function and show error tooltip if it fails
function safeExecute(fn, errorMessage = 'An error occurred') {
  try {
    return fn();
  } catch (error) {
    console.error(error);
    createTooltip(`Error: ${errorMessage}`, 'top');
    return null;
  }
}