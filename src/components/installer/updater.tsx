import {Box, Text, useApp} from 'ink';
import React, {useEffect, useState} from 'react';
import {createProFile, readLicenseKey} from '../../utils.js';
import {DownloadCLIStep} from './download-cli.js';
import {DownloadVSCodeExtensionStep} from './download-vscode-extension.js';

export enum UpdaterStep {
	DOWNLOAD_CLI,
	DOWNLOAD_VSCODE_EXTENSION,
}

export enum UpdaterStatus {
	LOADING = 'LOADING',
	SUCCESS = 'SUCCESS',
	ERROR = 'ERROR',
}

const steps = [
	{
		step: UpdaterStep.DOWNLOAD_CLI,
		Component: DownloadCLIStep,
	},
	{
		step: UpdaterStep.DOWNLOAD_VSCODE_EXTENSION,
		Component: DownloadVSCodeExtensionStep,
	},
];

export const Updater = ({
	cliVersion = 'latest',
	vscodeExtVersion = 'latest',
}: {
	cliVersion?: string;
	vscodeExtVersion?: string;
}) => {
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [isComplete, setIsComplete] = useState(false);
	const [licenseKey] = useState(() => readLicenseKey() || '');
	const [errorExiting, setErrorExiting] = useState(false);
	const [actualVersions, setActualVersions] = useState<{
		cli?: string;
		vscode?: string;
	}>({});
	const {exit} = useApp();

	const stepsToShow = steps.slice(0, currentStepIndex + 1);

	useEffect(() => {
		if (isComplete) {
			exit();
		}
	}, [isComplete]);

	return (
		<Box flexDirection="column" gap={2}>
			<Text>Updating jxscout pro...</Text>
			{stepsToShow.map((step, index) => {
				const commonProps = {
					index,
					onComplete: (success: boolean) => {
						if (!success) {
							setErrorExiting(true);
							setTimeout(() => {
								exit();
							}, 1000);
							return;
						}

						if (currentStepIndex < steps.length - 1) {
							setCurrentStepIndex(currentStepIndex + 1);
						} else {
							createProFile().finally(() => {
								setIsComplete(true);
							});
						}
					},
					onVersionUpdate: (version: string) => {
						if (step.step === UpdaterStep.DOWNLOAD_CLI) {
							setActualVersions(prev => ({...prev, cli: version}));
						} else if (step.step === UpdaterStep.DOWNLOAD_VSCODE_EXTENSION) {
							setActualVersions(prev => ({...prev, vscode: version}));
						}
					},
				};

				return (
					<React.Fragment key={index}>
						<step.Component
							{...commonProps}
							licenseKey={licenseKey}
							cliVersion={cliVersion}
							vscodeExtVersion={vscodeExtVersion}
							isUpdating={true}
						/>
					</React.Fragment>
				);
			})}

			{errorExiting && (
				<Box flexDirection="column" gap={1}>
					<Text color="red">
						There was an error during the update. Exiting... ❌
					</Text>
				</Box>
			)}

			{isComplete && (
				<Box flexDirection="column" gap={1}>
					<Text bold>Update complete ✅</Text>

					<Text>
						You can run jxscout pro with the command{' '}
						<Text bold>jxscout-pro</Text>
					</Text>

					{actualVersions.cli && <Text>CLI version: {actualVersions.cli}</Text>}
					{actualVersions.vscode && (
						<Text>VSCode extension version: {actualVersions.vscode}</Text>
					)}
				</Box>
			)}
		</Box>
	);
};
