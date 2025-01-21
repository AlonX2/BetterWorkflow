/**
 * Default constants and workflows
 */
import { WorkflowState } from "./types";

export const prettyColors = [
  '#2D3748',  // Dark slate blue
  '#5B2B8F',  // Rich purple
  '#1B4D89',  // Deep navy
  '#206A6B',  // Dark teal
  '#2D5A27',  // Forest green
  '#8B4513',  // Saddle brown
  '#8B2635',  // Dark crimson
  '#614051',  // Deep mauve
  '#4A5D7B',  // Steel blue
  '#3D6B4F',  // Pine green
  '#755C3B',  // Warm brown
  '#6B4E71',  // Dusty purple
  '#2B6B6B',  // Deep cyan
  '#744139',  // Rustic red
  '#4B692F',  // Olive drab
];

// Generate IDs for default states - using shorter format
function generateDefaultId(index: number): number {
  return index; // Just use simple sequential numbers for defaults
}

// Default workflow states
export const DEFAULT_STATES: WorkflowState[] = [
  // TODO -> DOING -> DONE (checkbox)
  {
    id: generateDefaultId(1),
    keyword: "TASK",
    color: prettyColors[2], // Deep navy
    hasCheckbox: true,
    checkboxState: {
      id: -2,
      keyword: "DONE",
      color: prettyColors[4], // Forest green
      next: undefined
    },
    next: {
      id: generateDefaultId(2),
      keyword: "DOING",
      color: prettyColors[5], // Saddle brown
      hasCheckbox: true,
      checkboxState: {
        id: -2,
        keyword: "DONE",
        color: prettyColors[4], // Forest green
        next: undefined
      },
      next: undefined
    }
  }
];
