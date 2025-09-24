import {Text} from 'ink';
import React from 'react';

export function Title({
	children,
}: {
	children?: React.ReactNode;
}): React.JSX.Element | null {
	return (
		<Text color="#A78BFA" bold>
			{children}
		</Text>
	);
}
