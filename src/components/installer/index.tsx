import {Box, Text, useApp} from 'ink';
import TextInput from 'ink-text-input';
import React, {useEffect, useState} from 'react';
import {createProFile, writeLicenseKey} from '../../utils.js';
import {BunInstallerStep} from './bun-installer.js';
import {DownloadCLIStep} from './download-cli.js';
import {DownloadProxyExtensionStep} from './download-proxy-extension.js';
import {DownloadVSCodeExtensionStep} from './download-vscode-extension.js';
import {UninstallOSSVersionStep} from './uninstall-oss.js';

export enum InstallerStep {
	LICENSE_KEY_INPUT,
	BUN_INSTALLER,
	UNINSTALL_OSS_VERSION,
	DOWNLOAD_CLI,
	DOWNLOAD_PROXY_EXTENSION,
	DOWNLOAD_VSCODE_EXTENSION,
}

export enum InstallerStatus {
	LOADING = 'LOADING',
	SUCCESS = 'SUCCESS',
	ERROR = 'ERROR',
}

const LicenseKeyInputStep = ({
	index,
	onComplete,
	onLicenseKeySet,
}: {
	index: number;
	onComplete: (success: boolean) => void;
	onLicenseKeySet: (licenseKey: string) => void;
}) => {
	const [licenseKey, setLicenseKey] = useState('');
	const [isCompleted, setIsCompleted] = useState(false);

	const handleSubmit = async (value: string) => {
		const trimmedKey = value.trim();
		if (trimmedKey === '') {
			return; // Don't complete if license key is empty
		}

		try {
			await writeLicenseKey(trimmedKey);
			onLicenseKeySet(trimmedKey);
			setIsCompleted(true);
			onComplete(true);
		} catch (error) {
			onComplete(false);
		}
	};

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>{`${index + 1}. Enter your license key`}</Text>
			{!isCompleted ? (
				<>
					<Text>Please enter your jxscout pro license key:</Text>
					<TextInput
						placeholder="Enter your license key"
						value={licenseKey}
						onChange={setLicenseKey}
						onSubmit={handleSubmit}
					/>
				</>
			) : (
				<Text>License key configured ✅</Text>
			)}
		</Box>
	);
};

const steps = [
	{
		step: InstallerStep.LICENSE_KEY_INPUT,
		Component: LicenseKeyInputStep,
	},
	{
		step: InstallerStep.BUN_INSTALLER,
		Component: BunInstallerStep,
	},
	{
		step: InstallerStep.UNINSTALL_OSS_VERSION,
		Component: UninstallOSSVersionStep,
	},
	{
		step: InstallerStep.DOWNLOAD_CLI,
		Component: DownloadCLIStep,
	},
	{
		step: InstallerStep.DOWNLOAD_PROXY_EXTENSION,
		Component: DownloadProxyExtensionStep,
	},
	{
		step: InstallerStep.DOWNLOAD_VSCODE_EXTENSION,
		Component: DownloadVSCodeExtensionStep,
	},
];

export const Installer = ({
	cliVersion = 'latest',
	vscodeExtVersion = 'latest',
}: {
	cliVersion?: string;
	vscodeExtVersion?: string;
}) => {
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [isComplete, setIsComplete] = useState(false);
	const [licenseKey, setLicenseKey] = useState('');
	const [errorExiting, setErrorExiting] = useState(false); // deal with weird bug when exiting that is clearing output
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
			<Text>
				It seems like this is the first time you are using jxscout pro. Running
				first time setup...
			</Text>
			{stepsToShow.map((step, index) => {
				const commonProps = {
					index,
					onComplete: (success: boolean) => {
						if (!success) {
							// make sure we render the last error message
							setErrorExiting(true);
							setTimeout(() => {
								exit();
							}, 100);
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
						if (step.step === InstallerStep.DOWNLOAD_CLI) {
							setActualVersions(prev => ({...prev, cli: version}));
						} else if (step.step === InstallerStep.DOWNLOAD_VSCODE_EXTENSION) {
							setActualVersions(prev => ({...prev, vscode: version}));
						}
					},
				};

				return (
					<React.Fragment key={index}>
						<step.Component
							{...commonProps}
							onLicenseKeySet={setLicenseKey}
							licenseKey={licenseKey}
							cliVersion={cliVersion}
							vscodeExtVersion={vscodeExtVersion}
						/>
					</React.Fragment>
				);
			})}

			{errorExiting && (
				<Box flexDirection="column" gap={1}>
					<Text color="red">
						There was an error during the installation. Exiting... ❌
					</Text>
				</Box>
			)}

			{isComplete && (
				<Box flexDirection="column" gap={1}>
					<Text bold>Installation complete ✅</Text>

					<Text>
						You can run jxscout pro with the command{' '}
						<Text bold>jxscout-pro</Text>
					</Text>
					{actualVersions.cli && <Text>CLI version: {actualVersions.cli}</Text>}
					{actualVersions.vscode && (
						<Text>VSCode extension version: {actualVersions.vscode}</Text>
					)}

					<Text>Thanks for using jxscout pro!</Text>
				</Box>
			)}
		</Box>
	);
};
