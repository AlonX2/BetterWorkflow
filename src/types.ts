import { prettyColors } from "./constants";

export type WorkflowState = {
  id: number;
  keyword: string;
  color: string;
  next?: WorkflowState | undefined;
  isLoop?: boolean;  // Used for UI rendering to indicate circular references
  circular?: boolean; // Indicates if this workflow is circular
  parentId?: number;  // Used when passing state for deletion
  hasCheckbox?: boolean; // Indicates if this workflow should show checkboxes
  checkboxState?: WorkflowState; // The separate state used for the checkbox
};

// Calculate whether to use dark or light text based on background color
function getContrastTextColor(hexColor: string): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#2D3748' : '#FFFFFF';
}

function getPrettyColor(): string {
  return prettyColors[Math.floor(Math.random() * prettyColors.length)];
}

export function buildWorkflowStates(keywords: string[], isCircular: boolean = true): WorkflowState[] {
  const states: WorkflowState[] = keywords.map((keyword, index) => ({
    id: index + 1,
    keyword,
    color: getPrettyColor(),
    next: undefined,
    circular: isCircular
  }));

  // Connect each state to the next one
  for (let i = 0; i < states.length; i++) {
    // Always connect to next state, and for the last state, connect back to first if circular
    states[i].next = i < states.length - 1 ? states[i + 1] : (isCircular ? states[0] : undefined);
  }

  return states;
}





