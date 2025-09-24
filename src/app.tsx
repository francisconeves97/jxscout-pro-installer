import {Box} from 'ink';
import {useMemo} from 'react';
import {Installer} from './components/installer/index.js';
import {Updater} from './components/installer/updater.js';
import {Title} from './components/title.js';
import {isAlreadyInstalled} from './utils.js';

const App = ({
	cliVersion = 'latest',
	vscodeExtVersion = 'latest',
}: {
	cliVersion?: string;
	vscodeExtVersion?: string;
}) => {
	const isInstalled = useMemo(() => isAlreadyInstalled(), []);

	let content = null;
	if (isInstalled) {
		content = (
			<Updater cliVersion={cliVersion} vscodeExtVersion={vscodeExtVersion} />
		);
	} else {
		content = (
			<Installer cliVersion={cliVersion} vscodeExtVersion={vscodeExtVersion} />
		);
	}

	return (
		<>
			<Title>jxscout pro installer</Title>
			<Box marginTop={1}>{content}</Box>
		</>
	);
};

export {App};
