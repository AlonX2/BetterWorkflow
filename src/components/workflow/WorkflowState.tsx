import React from 'react';
import { WorkflowState as WorkflowStateType } from '../../types';
import ColorPicker from './ColorPicker';
import '../../styles/workflowChain.css';

interface WorkflowStateProps {
  state: WorkflowStateType;
  index: number;
  chainLength: number;
  isHovered: boolean;
  colorPickerState: number | null;
  colorPickerPosition: string[];
  prettyColors: string[];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onColorChange: (state: WorkflowStateType, color: string) => void;
  onDeleteState?: (state: WorkflowStateType) => void;
  onCircularChange: () => void;
  setColorPickerState: (stateId: number | null) => void;
  setColorPickerPosition: (position: string[]) => void;
}

const WorkflowState: React.FC<WorkflowStateProps> = ({
  state,
  index,
  chainLength,
  isHovered,
  colorPickerState,
  colorPickerPosition,
  prettyColors,
  onMouseEnter,
  onMouseLeave,
  onColorChange,
  onDeleteState,
  onCircularChange,
  setColorPickerState,
  setColorPickerPosition
}) => {
  const calculateColorPickerPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const settingsContainer = e.currentTarget.closest('.settings-container');
    if (!settingsContainer) return [];
    
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
    
    return [`top: ${top}px`, `left: ${left}px`];
  };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCircularChange();
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
        opacity: state.isLoop ? 0.7 : 1,
        position: "relative"
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
          e.stopPropagation();
          const newPosition = calculateColorPickerPosition(e);
          if (newPosition.length > 0) {
            setColorPickerPosition(newPosition);
            setColorPickerState(colorPickerState === state.id ? null : state.id);
          }
        }}
      >
        {state.keyword}
        {colorPickerState === state.id && (
          <ColorPicker
            colors={prettyColors}
            selectedColor={state.color}
            position={colorPickerPosition}
            onColorSelect={(color) => onColorChange(state, color)}
          />
        )}
      </div>
      {index < chainLength - 1 && (
        <span style={{ 
          margin: "0 2px", 
          color: state.isLoop ? state.color : "#4a4a6a",
          fontSize: state.isLoop ? "16px" : "14px",
          fontWeight: state.isLoop ? "bold" : "normal",
          display: "flex",
          alignItems: "center",
          transform: state.isLoop ? "rotate(-45deg)" : "none",
          marginLeft: "6px",
          transition: "all 0.2s ease"
        }}>
          {state.isLoop ? "⟲" : "→"}
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
      {!state.isLoop && onDeleteState && (
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
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.2s ease",
            padding: 0
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default WorkflowState; 