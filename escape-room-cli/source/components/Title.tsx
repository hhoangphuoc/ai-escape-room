import React from 'react';
import {Box, Text} from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

const Title: React.FC = () => {
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box justifyContent="center" marginBottom={1}>
				<Gradient name="vice">
					<BigText text="Escape Room" />
				</Gradient>
			</Box>
			<Box justifyContent="center" marginBottom={1}>
				<Text bold color="cyan">
					Escaping from CLI terminal...
				</Text>
			</Box>
		</Box>
	);
};

export default Title;
