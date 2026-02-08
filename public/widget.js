/**
 * TableMaster Reservation Widget
 * Floating button reservation widget for restaurant websites
 *
 * Usage:
 * <script src="https://your-domain.com/widget.js" data-api-key="YOUR_API_KEY"></script>
 * The widget will automatically create a floating button - no container div needed!
 */

(function() {
  'use strict';

  // Get the current script tag
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  // Get identifier from data attribute (supports both API key and slug)
  const apiKey = currentScript.getAttribute('data-api-key');
  const slug = currentScript.getAttribute('data-slug');

  // Determine if we're using slug system
  const useSlug = currentScript.getAttribute('data-use-slug') === 'true' || !!slug;
  
  // Validate we have at least one identifier
  if (!apiKey && !slug) {
    console.error('[TableMaster Widget] Error: data-api-key or data-slug attribute is required');
    return;
  }

  // Configuration
  const config = {
    apiKey: slug || apiKey, // Use slug if provided, otherwise API key
    frontendUrl: currentScript.getAttribute('data-frontend-url') || 'http://localhost:3000',
    // Support both API key and slug systems
    useSlug: useSlug,
    // New configuration options for floating button - now with defaults that will be overridden by API
    position: currentScript.getAttribute('data-position') || 'bottom-right',
    buttonText: currentScript.getAttribute('data-button-text') || 'Réserver une table',
    buttonIcon: currentScript.getAttribute('data-button-icon') !== 'false', // Show icon by default
    modalWidth: currentScript.getAttribute('data-modal-width') || '500px',
    modalHeight: currentScript.getAttribute('data-modal-height') || '600px',
    primaryColor: currentScript.getAttribute('data-primary-color') || '#0066FF',
    buttonStyle: currentScript.getAttribute('data-button-style') || 'round', // round, square, minimal
    // Configuration from dashboard - will be fetched via API
    secondaryColor: currentScript.getAttribute('data-secondary-color') || '#2A2A2A',
    fontFamily: currentScript.getAttribute('data-font-family') || 'system-ui, sans-serif',
    borderRadius: currentScript.getAttribute('data-border-radius') || '4px',
  };

  // Wait for DOM to be ready
  function onDOMReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  // Fetch widget configuration from dashboard
  async function fetchWidgetConfig() {
    try {
      // Support both API key and slug systems
      const baseUrl = config.frontendUrl.replace('3000', '4000');
      let response;
      
      if (config.useSlug) {
        // Nouveau système avec slug
        response = await fetch(`${baseUrl}/api/public/widget-config`, {
          headers: {
            'x-slug': config.apiKey, // Dans le nouveau système, apiKey contient le slug
          },
        });
      } else {
        // Ancien système avec API key
        response = await fetch(`${baseUrl}/api/public/widget-config`, {
          headers: {
            'x-api-key': config.apiKey,
          },
        });
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.widgetConfig) {
          // Override config with dashboard settings
          Object.assign(config, data.widgetConfig);
          console.log('[TableMaster Widget] Configuration fetched from dashboard:', data.widgetConfig);
        }
      } else {
        console.warn('[TableMaster Widget] Could not fetch configuration from dashboard, using defaults');
      }
    } catch (error) {
      console.warn('[TableMaster Widget] Error fetching configuration, using defaults:', error);
    }
  }

  // Create floating button
  function createFloatingButton() {
    const button = document.createElement('button');
    button.id = 'tablemaster-floating-button';
    button.className = 'tablemaster-floating-button';
    button.innerHTML = config.buttonIcon ? `🍽️ ${config.buttonText}` : config.buttonText;
    button.setAttribute('aria-label', 'Ouvrir le formulaire de réservation');
    
    // Position styles
    const positionStyles = getPositionStyles(config.position);
    
    // Button styles based on style config - use button-specific colors
    const buttonStyles = getButtonStyles(config.buttonStyle, config.buttonBackgroundColor || config.primaryColor);
    
    // Apply all styles
    Object.assign(button.style, positionStyles, buttonStyles);
    
    // Apply button-specific text color if available
    if (config.buttonTextColor) {
      button.style.color = config.buttonTextColor;
    }
    
    return button;
  }

  // Get position styles based on configuration
  function getPositionStyles(position) {
    const basePosition = {
      position: 'fixed',
      zIndex: '9999',
    };

    switch (position) {
      case 'bottom-left':
        return {
          ...basePosition,
          bottom: '20px',
          left: '20px',
        };
      case 'top-right':
        return {
          ...basePosition,
          top: '20px',
          right: '20px',
        };
      case 'top-left':
        return {
          ...basePosition,
          top: '20px',
          left: '20px',
        };
      case 'bottom-right':
      default:
        return {
          ...basePosition,
          bottom: '20px',
          right: '20px',
        };
    }
  }

  // Get button styles based on style configuration
  function getButtonStyles(style, buttonBackgroundColor) {
    const baseStyles = {
      backgroundColor: buttonBackgroundColor,
      color: '#ffffff',
      border: 'none',
      padding: '12px 20px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      transition: 'all 0.3s ease',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    };

    switch (style) {
      case 'square':
        return {
          ...baseStyles,
          borderRadius: '4px',
        };
      case 'minimal':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          color: buttonBackgroundColor,
          border: `2px solid ${buttonBackgroundColor}`,
          borderRadius: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        };
      case 'round':
      default:
        return {
          ...baseStyles,
          borderRadius: '25px',
        };
    }
  }

  // Create modal overlay
  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'tablemaster-modal';
    modal.className = 'tablemaster-modal';
    
    const modalStyles = {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: '10000',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center',
      backdropFilter: 'blur(4px)',
    };
    
    Object.assign(modal.style, modalStyles);
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'tablemaster-modal-content';
    
    const contentStyles = {
      position: 'relative',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      width: config.modalWidth,
      height: config.modalHeight,
      maxWidth: '95vw',
      maxHeight: '95vh',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      overflow: 'hidden',
    };
    
    Object.assign(modalContent.style, contentStyles);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'tablemaster-close-button';
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', 'Fermer le formulaire');
    
    const closeButtonStyles = {
      position: 'absolute',
      top: '10px',
      right: '10px',
      background: 'rgba(255, 255, 255, 0.9)',
      border: 'none',
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      fontSize: '20px',
      cursor: 'pointer',
      zIndex: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.2s ease',
    };
    
    Object.assign(closeButton.style, closeButtonStyles);
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = `${config.frontendUrl}/embed/reservations/${config.apiKey}`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'auto');
    iframe.setAttribute('title', 'TableMaster Reservation Widget');
    iframe.setAttribute('aria-label', 'Formulaire de réservation');
    
    // Append elements
    modalContent.appendChild(closeButton);
    modalContent.appendChild(iframe);
    modal.appendChild(modalContent);
    
    // Add event listeners
    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // Handle iframe messages
    window.addEventListener('message', function(event) {
      // Verify origin for security
      if (event.origin !== config.frontendUrl) {
        return;
      }

      // Handle height adjustment messages
      if (event.data && event.data.type === 'tablemaster:resize') {
        iframe.style.height = event.data.height + 'px';
      }
      
      // Handle close modal message (when reservation is successful)
      if (event.data && event.data.type === 'tablemaster:close') {
        closeModal();
      }
    });
    
    return modal;
  }

  // Open modal
  function openModal() {
    const modal = document.getElementById('tablemaster-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }
  }

  // Close modal
  function closeModal() {
    const modal = document.getElementById('tablemaster-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = ''; // Restore background scroll
    }
  }

  // Initialize widget
  async function initWidget() {
    // Check if widget already exists
    if (document.getElementById('tablemaster-floating-button')) {
      console.log('[TableMaster Widget] Widget already initialized');
      return;
    }

    // Fetch configuration from dashboard first
    await fetchWidgetConfig();

    // Create floating button with fetched configuration
    const button = createFloatingButton();
    
    // Create modal
    const modal = createModal();
    
    // Add button click handler
    button.addEventListener('click', openModal);
    
    // Add hover effects
    button.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
      // Apply hover color if available
      if (config.buttonHoverColor) {
        this.style.backgroundColor = config.buttonHoverColor;
      }
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      // Restore original background color
      if (config.buttonBackgroundColor) {
        this.style.backgroundColor = config.buttonBackgroundColor;
      } else if (config.primaryColor) {
        this.style.backgroundColor = config.primaryColor;
      }
    });
    
    // Append to body
    document.body.appendChild(button);
    document.body.appendChild(modal);
    
    // Add keyboard navigation
    button.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal();
      }
    });
    
    // Add escape key handler for modal
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeModal();
      }
    });

    console.log('[TableMaster Widget] Floating button widget initialized successfully with dashboard config');
  }

  // Initialize when DOM is ready
  onDOMReady(() => {
    initWidget().catch(error => {
      console.error('[TableMaster Widget] Failed to initialize:', error);
    });
  });
})();
