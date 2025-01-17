import React from 'react';
import '../../styles/workflowChain.css';

interface ColorPickerProps {
  colors: string[];
  selectedColor: string;
  position: string[];
  onColorSelect: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  colors,
  selectedColor,
  position,
  onColorSelect
}) => {
  return (
    <div 
      className="color-picker-dropdown"
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        ...Object.fromEntries(position.map(pos => pos.split(': ')))
      }}
    >
      {colors.map((color, i) => (
        <div
          key={i}
          className="color-option"
          style={{ 
            backgroundColor: color,
            borderColor: color === selectedColor ? color : 'transparent',
            transform: color === selectedColor ? 'scale(1.1)' : 'none',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onColorSelect(color);
          }}
        />
      ))}
    </div>
  );
};

export default ColorPicker; 