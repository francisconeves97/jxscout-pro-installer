import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import {useEffect, useState} from 'react';
import {
	downloadProxyExtension,
	errorToString,
	getCurrentDirectory,
} from '../../utils.js';
import {Spinner} from '../spinner.js';
import {InstallerStatus} from './index.js';

const DEFAULT_DOWNLOAD_PATH = getCurrentDirectory();

const INSTALLATION_CHECK_OPTIONS = [
	{
		label: 'No, I need to download and install it',
		value: 'need_install',
	},
	{
		label: 'Yes, I already have the plugin installed',
		value: 'already_installed',
	},
];

const PROXY_OPTIONS = [
	{
		label: 'Caido',
		value: 'caido',
	},
	{
		label: 'Burp',
		value: 'burp',
	},
];

const DOWNLOAD_LINKS = {
	caido: 'https://github.com/francisconeves97/jxscout-caido',
	burp: 'https://github.com/francisconeves97/jxscout-burp',
};

enum ExtensionStep {
	INSTALLATION_CHECK,
	PROXY_SELECTION,
	DOWNLOADING,
	INSTALLATION_WAIT,
	COMPLETE,
}

export const DownloadProxyExtensionStep = ({
	index,
	onComplete,
}: {
	index: number;
	onComplete: (success: boolean) => void;
}) => {
	const [currentStep, setCurrentStep] = useState<ExtensionStep>(
		ExtensionStep.INSTALLATION_CHECK,
	);
	const [installationCheck, setInstallationCheck] = useState<
		(typeof INSTALLATION_CHECK_OPTIONS)[number] | null
	>(null);
	const [selectedProxy, setSelectedProxy] = useState<
		(typeof PROXY_OPTIONS)[number] | null
	>(null);
	const [downloadStatus, setDownloadStatus] = useState<InstallerStatus | null>(
		null,
	);
	const [downloadError, setDownloadError] = useState<string | null>(null);

	const handleInstallationCheckSelect = (
		item: (typeof INSTALLATION_CHECK_OPTIONS)[number],
	) => {
		setInstallationCheck(item);
		if (item.value === 'already_installed') {
			setCurrentStep(ExtensionStep.COMPLETE);
			onComplete(true);
		} else {
			setCurrentStep(ExtensionStep.PROXY_SELECTION);
		}
	};

	const handleProxySelect = (item: (typeof PROXY_OPTIONS)[number]) => {
		setSelectedProxy(item);
		setCurrentStep(ExtensionStep.DOWNLOADING);
	};

	useEffect(() => {
		if (currentStep === ExtensionStep.DOWNLOADING && selectedProxy) {
			const download = async () => {
				setDownloadStatus(InstallerStatus.LOADING);
				try {
					await downloadProxyExtension(
						selectedProxy.value as 'caido' | 'burp',
						DEFAULT_DOWNLOAD_PATH,
					);
					setDownloadStatus(InstallerStatus.SUCCESS);
					setCurrentStep(ExtensionStep.INSTALLATION_WAIT);
				} catch (error) {
					setDownloadStatus(InstallerStatus.ERROR);
					setDownloadError(errorToString(error));
					onComplete(false);
				}
			};
			download();
		}
	}, [currentStep, selectedProxy]);

	const handleInstallationComplete = () => {
		setCurrentStep(ExtensionStep.COMPLETE);
		onComplete(true);
	};

	const renderStep = () => {
		switch (currentStep) {
			case ExtensionStep.INSTALLATION_CHECK:
				return (
					<>
						<Text>
							Do you already have the jxscout proxy (Burp or Caido) plugin
							installed?
						</Text>
						<SelectInput
							items={INSTALLATION_CHECK_OPTIONS}
							onSelect={handleInstallationCheckSelect}
						/>
					</>
				);

			case ExtensionStep.PROXY_SELECTION:
				return (
					<>
						<Text>
							Select your proxy:{' '}
							{selectedProxy && <Text bold>{selectedProxy.label}</Text>}
						</Text>
						{!selectedProxy && (
							<SelectInput items={PROXY_OPTIONS} onSelect={handleProxySelect} />
						)}
					</>
				);

			case ExtensionStep.DOWNLOADING:
				return (
					<>
						<Box>
							{downloadStatus === InstallerStatus.LOADING && (
								<Text>
									<Spinner />{' '}
								</Text>
							)}
							<Text dimColor>
								Downloading plugin from{' '}
								{DOWNLOAD_LINKS[selectedProxy!.value as 'caido' | 'burp']}{' '}
								{downloadStatus === InstallerStatus.SUCCESS && <Text>✅</Text>}
								{downloadStatus === InstallerStatus.ERROR && <Text>❌</Text>}
							</Text>
						</Box>
						{downloadStatus === InstallerStatus.ERROR && (
							<>
								<Text color="red">Error downloading plugin: </Text>
								<Text color="red">{downloadError}</Text>
							</>
						)}
					</>
				);

			case ExtensionStep.INSTALLATION_WAIT:
				return (
					<>
						<Text>
							Please go ahead and install the plugin on your proxy. It was
							downloaded to: <Text bold>{DEFAULT_DOWNLOAD_PATH}</Text>
						</Text>
						<Text>When you are done, press enter to continue</Text>
						<TextInput
							value={''}
							onChange={() => {}}
							onSubmit={handleInstallationComplete}
							placeholder="Press enter to continue"
						/>
					</>
				);

			case ExtensionStep.COMPLETE:
				return (
					<Text>
						{installationCheck?.value === 'already_installed'
							? 'Plugin already installed, skipping this step... ✅'
							: 'Plugin setup complete ✅'}
					</Text>
				);

			default:
				return null;
		}
	};

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>{`${index + 1}. Setting up jxscout proxy plugin...`}</Text>
			{renderStep()}
		</Box>
	);
};
