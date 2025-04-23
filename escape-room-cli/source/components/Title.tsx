import React from 'react';
import { Box, Text } from 'ink';

const Title: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">
          {`
 ______                            ______                       
|  ____|                          |  ____|                      
| |__   ___  ___ __ _ _ __   ___ | |__   ___   ___  _ __ ___   
|  __| / __|/ __/ _\` | '_ \\ / _ \\|  __| / _ \\ / _ \\| '_ \` _ \\  
| |____\\__ \\ (_| (_| | |_) |  __/| |___| (_) | (_) | | | | | | 
|______|___/\\___\\__,_| .__/ \\___||______\\___/ \\___/|_| |_| |_| 
                     | |                                        
                     |_|                                        
          `}
        </Text>
      </Box>
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="red" dimColor={true}>Find a way to escape from this terminal...</Text>
      </Box>
    </Box>
  );
};

export default Title;