import {Text} from 'ink';
import {default as InkSpinner} from 'ink-spinner';

export const Spinner = () => {
	return (
		<Text>
			<InkSpinner type="dots" />
		</Text>
	);
};
