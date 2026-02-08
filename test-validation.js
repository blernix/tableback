// Test script to reproduce the widget config validation error
const { z } = require('zod');

// Copy the exact validation schema from the backend
const updateWidgetConfigSchema = z.object({
  // Form colors
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  fontFamily: z.string().min(1).max(100).optional(),
  borderRadius: z.string().regex(/^\d+px$/, 'Invalid border radius (must be in px)').optional(),
  // Button specific colors
  buttonBackgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  buttonTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  buttonHoverColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  // Floating button general configs
  buttonText: z.string().min(1).max(50).optional(),
  buttonPosition: z.enum(['bottom-right']).optional(), // Only bottom-right now
  buttonStyle: z.enum(['round', 'square', 'minimal']).optional(),
  buttonIcon: z.boolean().optional(),
  modalWidth: z.string().regex(/^\d+(px|%)$/, 'Invalid width (must be px or %)').optional(),
  modalHeight: z.string().regex(/^\d+(px|%)$/, 'Invalid height (must be px or %)').optional(),
});

// Test data from frontend
const testData = {
  primaryColor: "#0066FF",
  secondaryColor: "#2A2A2A", 
  fontFamily: "system-ui, sans-serif",
  borderRadius: "4px",
  buttonBackgroundColor: "#0066FF",
  buttonTextColor: "#FFFFFF",
  buttonHoverColor: "#0052EB",
  buttonText: "Réserver une table",
  buttonPosition: "bottom-right",
  buttonStyle: "round",
  buttonIcon: false,
  modalWidth: "500px",
  modalHeight: "600px"
};

console.log("Testing validation schema...");
console.log("Test data:", JSON.stringify(testData, null, 2));

try {
  const validatedData = updateWidgetConfigSchema.parse(testData);
  console.log("✅ Validation passed!");
  console.log("Validated data:", JSON.stringify(validatedData, null, 2));
} catch (error) {
  console.log("❌ Validation failed!");
  console.log("Error details:", JSON.stringify(error.errors, null, 2));
}