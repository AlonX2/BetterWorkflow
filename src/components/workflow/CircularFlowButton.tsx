import React from 'react';

interface CircularFlowButtonProps {
  isCircular: boolean | undefined;
  disabled: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const CircularFlowButton: React.FC<CircularFlowButtonProps> = ({
  isCircular = false,
  disabled,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px",
        fontSize: "12px",
        color: "#9BA3AF",
        background: isCircular ? "#3182CE20" : "#2d2d44",
        border: `1px solid ${isCircular ? "#3182CE" : "#4a4a6a"}`,
        borderRadius: "4px",
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s ease"
      }}
    >
      <span style={{
        width: "16px",
        height: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        background: isCircular ? "#3182CE" : "#4a4a6a",
        color: "#fff",
        fontSize: "14px"
      }}>
        <span style={{ display: 'inline-block', marginTop: '-3px' }}>↺</span>
      </span>
      <span style={{ color: isCircular ? "#3182CE" : "#9BA3AF" }}>
        Circular Flow
      </span>
    </button>
  );
};

export default CircularFlowButton; 