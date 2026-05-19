/**
 * Widget configuration defaults
 *
 * Source unique de vérité pour toutes les valeurs par défaut du widget.
 * Les contrôleurs backend appliquent ces defaults avant de renvoyer la config,
 * le frontend et widget.js reçoivent donc toujours des valeurs complètes.
 */
export interface WidgetConfig {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonHoverColor: string;
  buttonText: string;
  buttonPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  buttonStyle: 'round' | 'square' | 'minimal';
  buttonIcon: boolean;
  modalWidth: string;
  modalHeight: string;
}

export const WIDGET_DEFAULTS: WidgetConfig = {
  primaryColor: '#0066FF',
  secondaryColor: '#2A2A2A',
  fontFamily: 'system-ui, sans-serif',
  borderRadius: '8px',
  buttonBackgroundColor: '#0066FF',
  buttonTextColor: '#FFFFFF',
  buttonHoverColor: '#0052CC',
  buttonText: 'Réserver une table',
  buttonPosition: 'bottom-right',
  buttonStyle: 'round',
  buttonIcon: false,
  modalWidth: '500px',
  modalHeight: '600px',
};

/**
 * Merge restaurant widgetConfig with defaults.
 * Returns a complete WidgetConfig object with all fields filled.
 */
export function applyWidgetDefaults(overrides: Record<string, any> | null | undefined): WidgetConfig {
  const merged: Record<string, any> = { ...WIDGET_DEFAULTS };

  if (overrides) {
    for (const key of Object.keys(WIDGET_DEFAULTS)) {
      if (overrides[key] !== undefined && overrides[key] !== null) {
        merged[key] = overrides[key];
      }
    }
  }

  return merged as WidgetConfig;
}
