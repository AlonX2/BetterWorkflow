import React, { useState } from "react";
import "@logseq/libs";
import { WorkflowState } from "../types";

// Setup logger with timestamp
const log = {
  info: (msg: string, data?: any) => console.log(`[WorkflowMacro][${new Date().toISOString()}] INFO: ${msg}`, data ? data : ''),
  error: (msg: string, error?: any) => console.error(`[WorkflowMacro][${new Date().toISOString()}] ERROR: ${msg}`, error ? error : ''),
  debug: (msg: string, data?: any) => console.debug(`[WorkflowMacro][${new Date().toISOString()}] DEBUG: ${msg}`, data ? data : ''),
  perf: (msg: string, data?: any) => console.log(`[WorkflowMacro][${new Date().toISOString()}] PERF: ${msg}`, data ? data : '')
};

// Calculate optimal text color based on background color
function getContrastTextColor(hexColor: string): string {
  log.debug('Calculating contrast text color for', hexColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.5 ? "#1A202C" : "#FFFFFF";
  log.debug('Calculated text color', textColor);
  return textColor;
}

// Darken a hex color by a percentage
function darkenColor(hexColor: string, percent: number): string {
  log.debug('Darkening color', { hexColor, percent });
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  const darkenAmount = 1 - percent / 100;
  const dr = Math.floor(r * darkenAmount);
  const dg = Math.floor(g * darkenAmount);
  const db = Math.floor(b * darkenAmount);
  
  const darkenedColor = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
  log.debug('Darkened color result', darkenedColor);
  return darkenedColor;
}

// Encode a numeric ID to a short string using base36
function encodeStateId(id: number): string {
  // For negative IDs (checkbox states), use high numbers
  const shortId = id < 0 ? 900000 + Math.abs(id) : id;
  // Convert to base36 for shortest possible representation
  return shortId.toString(36);
}

interface WorkflowMacroProps {
  blockId: string;
  initWorkflowState: WorkflowState;
  workflowStates: WorkflowState[];
}

export const WorkflowMacro: React.FC<WorkflowMacroProps> = ({ blockId, initWorkflowState, workflowStates }) => {
  const renderStart = performance.now();
  log.perf('Starting macro render', { blockId, initWorkflowState });
  
  const [currentState, setCurrentState] = useState<WorkflowState>(initWorkflowState);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  React.useEffect(() => {
    const renderEnd = performance.now();
    log.perf('Macro render complete', { 
      blockId,
      renderTimeMs: renderEnd - renderStart,
      stateId: currentState.id,
      keyword: currentState.keyword
    });
  }, []);

  // Check if we're in a checkbox state (i.e., this state is a checkbox state)
  const isCheckboxState = currentState.id < 0;
  
  // Find the parent state if we're in a checkbox state
  const findParentState = (): WorkflowState | undefined => {
    const searchStart = performance.now();
    const result = (() => {
      if (!isCheckboxState) return undefined;
      
      // Search through all workflow states to find the one that has this as its checkbox state
      for (const workflow of workflowStates) {
        let current: WorkflowState | undefined = workflow;
        const visited = new Set<number>();
        
        while (current && !visited.has(current.id)) {
          if (current.hasCheckbox && current.checkboxState?.id === currentState.id) {
            return current;
          }
          visited.add(current.id);
          current = current.next;
        }
      }
      return undefined;
    })();
    
    const searchEnd = performance.now();
    log.perf('Parent state search complete', {
      blockId,
      searchTimeMs: searchEnd - searchStart,
      found: !!result,
      currentStateId: currentState.id
    });
    return result;
  };

  const parentState = findParentState();

  const handleStateChange = async (e: React.MouseEvent) => {
    const transitionStart = performance.now();
    log.perf('Starting state transition', {
      blockId,
      fromStateId: currentState.id,
      fromKeyword: currentState.keyword
    });
    
    // If clicking the checkbox area and we have a checkbox state defined, transition to it
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const isCheckboxClick = e.clientX - rect.left < 24; // Check if click is in the first 24px (checkbox area)
    
    if (isTransitioning) {
      log.debug('Skipping state change - transition in progress');
      return;
    }

    let transitionError: Error | undefined;
    try {
      setIsTransitioning(true);
      if (isCheckboxClick) {
        e.stopPropagation();
        const block = await logseq.Editor.getBlock(blockId);
        if (!block) {
          log.error('Block not found', blockId);
          return;
        }

        const content = block.content;
        // Updated regex to match the new format with encoded ID
        const macroRegex = /\{\{renderer workflow,\s*([^,}]+)(?:,\s*[^,}]+)?\}\}/;
        const match = content.match(macroRegex);
        const textAfterMacro = match ? content.slice(match.index! + match[0].length) : '';

        if (isCheckboxState && parentState) {
          // If we're in checkbox state, transition back to parent state
          log.info('Unchecking - returning to parent state', { blockId, parentState });
          await logseq.Editor.updateBlock(
            blockId,
            `{{renderer workflow, ${parentState.keyword}, ${encodeStateId(parentState.id)}}}${textAfterMacro}`
          );
          setCurrentState(parentState);
        } else if (currentState.hasCheckbox && currentState.checkboxState) {
          // If we're in a regular state with checkbox, transition to checkbox state
          log.info('Checking - transitioning to checkbox state', { blockId, checkboxState: currentState.checkboxState });
          await logseq.Editor.updateBlock(
            blockId,
            `{{renderer workflow, ${currentState.checkboxState.keyword}, ${encodeStateId(currentState.checkboxState.id)}}}${textAfterMacro}`
          );
          setCurrentState(currentState.checkboxState);
        }
      }

      if (!currentState.next) {
        log.debug('No next state available');
        return;
      }

      log.debug('Handling state change', { 
        currentId: currentState.id, 
        nextId: currentState.next.id,
        currentKeyword: currentState.keyword,
        nextKeyword: currentState.next.keyword
      });

      // Prevent transitioning to the same state
      if (currentState.next.id === currentState.id) {
        log.debug('Skipping transition to same state');
        return;
      }

      // Get current block content
      const block = await logseq.Editor.getBlock(blockId);
      if (!block) {
        log.error('Block not found', blockId);
        return;
      }

      // Extract content after the workflow macro
      const content = block.content;
      // Updated regex to match the new format with encoded ID
      const macroRegex = /\{\{renderer workflow,\s*([^,}]+)(?:,\s*[^,}]+)?\}\}/;
      const match = content.match(macroRegex);
      const textAfterMacro = match ? content.slice(match.index! + match[0].length) : '';

      log.info('Updating block content', { blockId, nextState: currentState.next });
      await logseq.Editor.updateBlock(
        blockId,
        `{{renderer workflow, ${currentState.next.keyword}, ${encodeStateId(currentState.next.id)}}}${textAfterMacro}`
      );
      setCurrentState(currentState.next);
    } catch (error) {
      transitionError = error as Error;
      log.error('Failed to update block content', error);
    } finally {
      setIsTransitioning(false);
      const transitionEnd = performance.now();
      log.perf('State transition complete', {
        blockId,
        transitionTimeMs: transitionEnd - transitionStart,
        fromStateId: currentState.id,
        toStateId: currentState.next?.id,
        success: !transitionError
      });
    }
  };

  const textColor = getContrastTextColor(currentState.color);
  const backgroundColor = currentState.color + "20";
  const borderColor = isHovered ? darkenColor(currentState.color, 20) : currentState.color;

  return (
    <div
      onClick={handleStateChange}
      onMouseEnter={() => {
        log.debug('Mouse entered workflow macro', currentState);
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        log.debug('Mouse left workflow macro', currentState);
        setIsHovered(false);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        backgroundColor: currentState.color,
        borderRadius: "3px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        userSelect: "none",
        fontFamily: "inherit",
        fontSize: "0.9rem",
        lineHeight: "1.2",
        fontWeight: 500,
        boxShadow: isHovered ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
        transform: isHovered ? "translateY(-1px)" : "none",
        gap: "6px"
      }}
    >
      {(currentState.hasCheckbox || parentState) && (
        <div
          style={{
            width: "14px",
            height: "14px",
            border: `1.5px solid ${textColor}`,
            borderRadius: "3px",
            opacity: 0.9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease"
          }}
        >
          {isCheckboxState && (
            <div
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: textColor,
                borderRadius: "1px",
                opacity: 0.9
              }}
            />
          )}
        </div>
      )}
      <span style={{ color: textColor }}>{currentState.keyword}</span>
    </div>
  );
};