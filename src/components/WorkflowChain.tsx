import React, { useState, useEffect } from "react";
import { WorkflowState } from "../types";
import CircularFlowButton from "./workflow/CircularFlowButton";
import CheckboxButton from "./workflow/CheckboxButton";
import { createLogger } from "../utils/workflowLogger";

// Setup logger
const log = createLogger('WorkflowChain');

interface WorkflowChainProps {
  workflow: WorkflowState;
  onCircularChange?: (isCircular: boolean) => void;
  onCheckboxChange?: (hasCheckbox: boolean, checkboxState?: WorkflowState) => void;
  onDeleteState?: (state: WorkflowState) => void;
  onColorChange?: (state: WorkflowState, newColor: string) => void;
  prettyColors: string[];
}

const WorkflowChain: React.FC<WorkflowChainProps> = ({ 
  workflow, 
  onCircularChange, 
  onCheckboxChange,
  onDeleteState,
  onColorChange,
  prettyColors 
}) => {
  // Helper function to count states in workflow
  const countWorkflowStates = (state: WorkflowState): number => {
    let count = 1;
    let current = state.next;
    const visited = new Set<number>([state.id]);
    
    while (current && !visited.has(current.id)) {
      count++;
      visited.add(current.id);
      current = current.next;
    }
    
    return count;
  };

  log.startTimer('workflow-chain-render');
  log.info('Rendering WorkflowChain', { 
    workflowId: workflow.id, 
    circular: workflow.circular, 
    hasCheckbox: workflow.hasCheckbox,
    stateCount: countWorkflowStates(workflow)
  });
  
  const [hoveredStateId, setHoveredStateId] = useState<number | null>(null);
  const [colorPickerState, setColorPickerState] = useState<number | null>(null);
  const [colorPickerPosition, setColorPickerPosition] = useState<string[]>([]);
  const [showCheckboxModal, setShowCheckboxModal] = useState(false);
  const [checkboxStateName, setCheckboxStateName] = useState("");

  const handleCircularChange = (newValue: boolean) => {
    log.startTimer('handle-circular-change');
    log.debug('Circular state change requested', { 
      workflowId: workflow.id,
      currentValue: workflow.circular,
      newValue
    });
    
    try {
      onCircularChange?.(newValue);
    } catch (error) {
      log.error('Error handling circular change', { error, newValue });
    } finally {
      log.endTimer('handle-circular-change');
    }
  };

  const handleCheckboxChange = (newValue: boolean) => {
    log.startTimer('handle-checkbox-change');
    log.debug('Checkbox state change requested', {
      workflowId: workflow.id,
      currentValue: workflow.hasCheckbox,
      newValue
    });
    
    try {
      if (newValue) {
        setShowCheckboxModal(true);
      } else {
        onCheckboxChange?.(false);
      }
    } catch (error) {
      log.error('Error handling checkbox change', { error, newValue });
    } finally {
      log.endTimer('handle-checkbox-change');
    }
  };

  const handleCheckboxSubmit = () => {
    log.startTimer('handle-checkbox-submit');
    log.debug('Checkbox state submission', {
      workflowId: workflow.id,
      checkboxStateName
    });
    
    try {
      // Create a new checkbox state with a unique negative ID
      const checkboxState: WorkflowState = {
        id: -Date.now(), // Use negative timestamp to ensure uniqueness
        keyword: checkboxStateName,
        color: workflow.color, // Start with the same color as the workflow
      };
      onCheckboxChange?.(true, checkboxState);
      setShowCheckboxModal(false);
    } catch (error) {
      log.error('Error handling checkbox submit', { error, checkboxStateName });
    } finally {
      log.endTimer('handle-checkbox-submit');
    }
  };

  const handleColorChange = (state: WorkflowState, color: string) => {
    log.debug('Color changed for state', { stateId: state.id, color });
    if (state.id < 0) {
      // If it's the checkbox state, create a new one with updated color
      const updatedCheckboxState: WorkflowState = {
        ...state,
        color
      };
      onCheckboxChange?.(true, updatedCheckboxState);
    } else {
      onColorChange?.(state, color);
    }
    setColorPickerState(null);
  };

  const getWorkflowChain = (workflow: WorkflowState): WorkflowState[] => {
    log.debug('Generating workflow chain', { startId: workflow.id });
    const chain: WorkflowState[] = [];
    const visited = new Set<number>();
    let current: WorkflowState | undefined = workflow;

    // Handle single-state circular workflow
    if (workflow.next && workflow.next.id === workflow.id) {
      log.debug('Single-state circular workflow detected');
      return [workflow, {...workflow, isLoop: true}];
    }

    // Build the chain and detect cycles
    while (current && !visited.has(current.id)) {
      chain.push(current);
      visited.add(current.id);
      current = current.next;

      // If we've reached a state that points back to the head
      if (current?.id === workflow.id) {
        if (workflow.circular) {
          chain.push({...current, isLoop: true});
        }
        break;
      }
    }

    // If workflow has checkbox enabled and a checkbox state exists, add it at the end
    if (workflow.hasCheckbox && workflow.checkboxState) {
      chain.push(workflow.checkboxState);
    }

    log.debug('Generated workflow chain', { 
      chainLength: chain.length, 
      states: chain.map(s => ({ id: s.id, keyword: s.keyword })),
      isCircular: workflow.circular,
      hasCheckbox: workflow.hasCheckbox,
      hasCycle: current !== undefined
    });
    return chain;
  };

  const chain = getWorkflowChain(workflow);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      const duration = log.endTimer('workflow-chain-render');
      if (duration > 0) { // Only log if timer was active (meaning perf level is enabled)
        log.perf('WorkflowChain unmounting', {
          workflowId: workflow.id,
          renderDuration: duration
        });
      }
    };
  }, []);

  // Log performance metrics on re-renders
  useEffect(() => {
    const duration = log.endTimer('workflow-chain-render');
    if (duration > 0) { // Only log if timer was active (meaning perf level is enabled)
      log.perf('WorkflowChain re-rendered', {
        workflowId: workflow.id,
        stateCount: countWorkflowStates(workflow),
        hasHoveredState: hoveredStateId !== null,
        hasColorPicker: colorPickerState !== null,
        showingCheckboxModal: showCheckboxModal
      });
    }
    log.startTimer('workflow-chain-render');
  });

  return (
    <div>
      <style>
        {`
          .color-picker-dropdown {
            position: absolute;
            background: #1a1b2e;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 12px;
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            z-index: 1000;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          }
          .color-option {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 2px solid transparent;
          }
          .color-option:hover {
            transform: scale(1.15);
            border-color: rgba(255, 255, 255, 0.5);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          }
          .workflow-state {
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            padding: 2px 4px;
            border-radius: 4px;
          }
          .workflow-state:hover {
            background: rgba(255, 255, 255, 0.1);
          }
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .modal {
            background: #1B1B1B;
            border-radius: 8px;
            padding: 20px;
            width: 320px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
          .modal-title {
            color: #E6E6E6;
            font-size: 14px;
            margin-bottom: 16px;
            font-weight: 500;
          }
          .modal-input {
            width: 100%;
            box-sizing: border-box;
            padding: 8px 12px;
            background: #141414;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: #E6E6E6;
            font-size: 14px;
            margin-bottom: 16px;
            font-family: inherit;
            line-height: 1.4;
          }
          .modal-input:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.2);
          }
          .modal-buttons {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }
          .modal-button {
            padding: 6px 16px;
            border-radius: 6px;
            border: none;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .modal-button.primary {
            background: #0066FF;
            color: white;
          }
          .modal-button.primary:hover {
            background: #0052CC;
          }
          .modal-button.secondary {
            background: transparent;
            color: #999;
          }
          .modal-button.secondary:hover {
            color: #E6E6E6;
          }
        `}
      </style>
      {showCheckboxModal && (
        <div className="modal-overlay" onClick={() => setShowCheckboxModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Enter the name for the checkbox state</div>
            <input
              type="text"
              className="modal-input"
              value={checkboxStateName}
              onChange={e => setCheckboxStateName(e.target.value)}
              placeholder="A checked state name (e.g. Done)"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && checkboxStateName.trim()) {
                  handleCheckboxSubmit();
                }
              }}
            />
            <div className="modal-buttons">
              <button 
                className="modal-button secondary"
                onClick={() => setShowCheckboxModal(false)}
              >
                Cancel
              </button>
              <button
                className="modal-button primary"
                onClick={handleCheckboxSubmit}
                disabled={!checkboxStateName.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px"
      }}>
        <CircularFlowButton
          isCircular={workflow.circular}
          disabled={chain.filter(state => state.id > 0).length <= 1}
          onClick={(e) => {
            e.stopPropagation();
            handleCircularChange(!workflow.circular);
          }}
        />
        <CheckboxButton
          hasCheckbox={workflow.hasCheckbox}
          disabled={chain.length === 0}
          onClick={(e) => {
            e.stopPropagation();
            handleCheckboxChange(!workflow.hasCheckbox);
          }}
        />
      </div>
      <div style={{
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
      }}>
        {chain.map((state, index) => {
          const isCheckboxState = state.id < 0; // Use negative ID to identify checkbox state
          log.debug('Rendering chain state', { 
            stateId: state.id, 
            keyword: state.keyword, 
            position: index,
            isLoop: state.isLoop,
            isCheckboxState
          });
          return (
            <div
              key={`${state.id}-${index}`}
              onMouseEnter={() => setHoveredStateId(state.id)}
              onMouseLeave={() => setHoveredStateId(null)}
              onClick={(e) => {
                // Only handle click if it's directly on this div, not on children
                if (e.target === e.currentTarget && !isCheckboxState && !state.isLoop) {
                  e.stopPropagation();
                  // Preserve checkbox state when toggling circularity
                  const newCircular = !workflow.circular;
                  handleCircularChange(newCircular);
                  if (workflow.hasCheckbox) {
                    onCheckboxChange?.(true, workflow.checkboxState);
                  }
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "4px 10px",
                backgroundColor: state.color + "20",
                borderRadius: "12px",
                border: `1px solid ${state.color}`,
                fontSize: "13px",
                opacity: 1,
                position: "relative",
                cursor: state.isLoop ? "default" : "pointer"
              }}
            >
              <span style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: state.color,
                marginRight: "6px",
              }} />
              <div 
                className="workflow-state"
                onClick={(e) => {
                  if (state.isLoop) return;
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const settingsContainer = e.currentTarget.closest('.settings-container');
                  if (!settingsContainer) return;
                  
                  const settingsRect = settingsContainer.getBoundingClientRect();
                  
                  // Calculate picker dimensions
                  const pickerWidth = 180;  // 5 columns * (28px + 8px gap)
                  const pickerHeight = 140;  // 4 rows * (28px + 8px gap)
                  
                  // Calculate available space
                  const spaceBelow = settingsRect.bottom - rect.bottom - 16; // 16px margin
                  const spaceAbove = rect.top - settingsRect.top - 16;
                  
                  // Calculate position relative to the workflow state
                  let left = -pickerWidth/2 + rect.width/2;
                  let top = rect.height + 8; // 8px gap below by default
                  
                  // Check if we need to flip up
                  if (spaceBelow < pickerHeight && spaceAbove > pickerHeight) {
                    top = -(pickerHeight + 8); // 8px gap above
                  }
                  
                  // Ensure picker stays within settings container horizontally
                  const stateLeftOffset = rect.left - settingsRect.left;
                  const wouldOverflowLeft = stateLeftOffset + left < 16;
                  const wouldOverflowRight = stateLeftOffset + left + pickerWidth > settingsRect.width - 16;
                  
                  if (wouldOverflowLeft) {
                    left = -stateLeftOffset + 16; // 16px from left edge
                  } else if (wouldOverflowRight) {
                    left = settingsRect.width - stateLeftOffset - pickerWidth - 16; // 16px from right edge
                  }

                  setColorPickerPosition([`top: ${top}px`, `left: ${left}px`]);
                  setColorPickerState(colorPickerState === state.id ? null : state.id);
                }}
              >
                {state.keyword}
                {colorPickerState === state.id && !state.isLoop && (
                  <div 
                    className="color-picker-dropdown"
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      ...Object.fromEntries(colorPickerPosition.map(pos => pos.split(': ')))
                    }}
                  >
                    {prettyColors.map((color, i) => (
                      <div
                        key={i}
                        className="color-option"
                        style={{ 
                          backgroundColor: color,
                          borderColor: color === state.color ? color : 'transparent',
                          transform: color === state.color ? 'scale(1.1)' : 'none',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleColorChange(state, color);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {index < chain.length - 1 && !chain[index + 1].id?.toString().startsWith('-') && (
                <span style={{ 
                  margin: "0 2px", 
                  color: state.isLoop ? state.color : "#888888",
                  fontSize: state.isLoop ? "16px" : "15px",
                  fontWeight: state.isLoop ? "bold" : "normal",
                  display: "flex",
                  alignItems: "center",
                  transform: state.isLoop ? "rotate(-45deg)" : "none",
                  marginLeft: "6px",
                  transition: "all 0.2s ease",
                  opacity: state.isLoop ? 1 : 0.9
                }}>
                  {state.isLoop ? "⟲" : "➜"}
                </span>
              )}
              {state.isLoop && (
                <div style={{
                  position: "absolute",
                  top: "-8px",
                  right: "-8px",
                  backgroundColor: state.color,
                  color: "#fff",
                  borderRadius: "50%",
                  width: "16px",
                  height: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}>
                  ↺
                </div>
              )}
              {isCheckboxState && (
                <div style={{
                  position: "absolute",
                  top: "-8px",
                  right: "-8px",
                  backgroundColor: state.color,
                  color: "#fff",
                  borderRadius: "3px",
                  width: "16px",
                  height: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}>
                  ☑
                </div>
              )}
              {!state.isLoop && !isCheckboxState && onDeleteState && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteState(state);
                  }}
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    width: "16px",
                    height: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    backgroundColor: "rgba(255, 95, 95, 0.1)",
                    color: "#ff5f5f",
                    border: "none",
                    borderRadius: "50%",
                    cursor: "pointer",
                    opacity: hoveredStateId === state.id ? 1 : 0,
                    transition: "opacity 0.2s ease",
                    padding: 0
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowChain; 