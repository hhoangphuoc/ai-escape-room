import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Gradient from 'ink-gradient';
import { MODELS_COLLECTION, ModelOption } from '../utils/constants.js';




interface ModelSelectorProps {
  onSelect: (model: ModelOption) => void;
  onClose: () => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ onSelect, onClose }) => {
  const handleSelect = (item: ModelOption) => {
    onSelect(item);
    onClose();
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Gradient name="vice">
        <Text bold>Select AI Model</Text>
      </Gradient>
      <Text>Choose which AI model to use for natural language interactions:</Text>
      
      <Box marginY={1}>
        <SelectInput items={Object.values(MODELS_COLLECTION).map(model => ({
            label: model.label,
            description: model.description,
            value: model.label,
        }))} onSelect={handleSelect} />
      </Box>
      
      <Text color="gray">Press ESC to cancel</Text>
    </Box>
  );
};

export default ModelSelector; 