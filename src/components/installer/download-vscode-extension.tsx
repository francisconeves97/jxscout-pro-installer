import {createWriteStream} from 'fs';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import path from 'path';
import {useEffect, useState} from 'react';
import {pipeline} from 'stream/promises';
import {deleteFile, errorToString, runCommand} from '../../utils.js';
import {Spinner} from '../spinner.js';
import {InstallerStatus} from './index.js';

export enum EditorType {
	CURSOR = 'cursor',
	VSCODE = 'vscode',
}

const EDITOR_OPTIONS = [
	{
		label: 'Cursor',
		value: EditorType.CURSOR,
	},
	{
		label: 'VSCode',
		value: EditorType.VSCODE,
	},
];

enum ExtensionStep {
	SELECTING_EDITOR,
	DOWNLOADING,
	INSTALLING,
	COMPLETE,
}

const downloadVSCodeExtension = async (
	licenseKey: string,
	downloadPath: string,
	requestedVersion: string = 'latest',
): Promise<{extensionPath: string; version: string}> => {
	const params = new URLSearchParams({
		version: requestedVersion,
		type: 'vscode-extension',
		licenseKey,
	});

	const response = await fetch(`https://jxscout.app/api/download?${params}`, {
		method: 'GET',
	});

	if (response.status === 401) {
		throw new Error('Invalid license key');
	}

	if (!response.ok) {
		throw new Error(`Failed to get download URL: ${response.statusText}`);
	}

	const {downloadUrl, version} = (await response.json()) as {
		downloadUrl: string;
		version: string;
	};

	const fileName = `jxscout-extension-${version}.vsix`;
	const filePath = path.join(downloadPath, fileName);

	const downloadResponse = await fetch(downloadUrl);
	if (!downloadResponse.ok) {
		throw new Error(
			`Failed to download extension: ${downloadResponse.statusText}`,
		);
	}

	if (!downloadResponse.body) {
		throw new Error('Download response body is null');
	}

	const fileStream = createWriteStream(filePath);
	await pipeline(downloadResponse.body as any, fileStream);

	return {extensionPath: filePath, version};
};

const installExtension = async (
	extensionPath: string,
	editorType: EditorType,
): Promise<void> => {
	const command = editorType === EditorType.CURSOR ? 'cursor' : 'code';

	// First, try to uninstall the existing extension to avoid version conflicts
	try {
		await runCommand(`${command} --uninstall-extension jxscout.jxscout-vscode`);
	} catch {
		// Ignore errors if extension is not installed
	}

	// Install the new extension
	const result = await runCommand(
		`${command} --install-extension "${extensionPath}"`,
	);
	if (!result.success) {
		throw new Error(`Failed to install extension: ${result.error}`);
	}
};

export const DownloadVSCodeExtensionStep = ({
	index,
	licenseKey,
	onComplete,
	vscodeExtVersion = 'latest',
	isUpdating = false,
	onVersionUpdate,
}: {
	index: number;
	licenseKey: string;
	onComplete: (success: boolean) => void;
	vscodeExtVersion?: string;
	isUpdating?: boolean;
	onVersionUpdate?: (version: string) => void;
}) => {
	const [currentStep, setCurrentStep] = useState<ExtensionStep>(
		ExtensionStep.SELECTING_EDITOR,
	);
	const [selectedEditor, setSelectedEditor] = useState<EditorType | null>(null);
	const [extensionStatus, setExtensionStatus] =
		useState<InstallerStatus | null>(null);
	const [extensionError, setExtensionError] = useState<string | null>(null);
	const [extensionPath, setExtensionPath] = useState<string | null>(null);
	const [actualVersion, setActualVersion] = useState<string | null>(null);

	useEffect(() => {
		if (currentStep === ExtensionStep.DOWNLOADING && selectedEditor) {
			const downloadAndInstall = async () => {
				setExtensionStatus(InstallerStatus.LOADING);
				let downloaded = false;
				try {
					const downloadPath = process.cwd();
					const {extensionPath: downloadedPath, version} =
						await downloadVSCodeExtension(
							licenseKey,
							downloadPath,
							vscodeExtVersion,
						);

					setActualVersion(version);
					onVersionUpdate?.(version);
					setExtensionPath(downloadedPath);
					setCurrentStep(ExtensionStep.INSTALLING);

					downloaded = true;
					await installExtension(downloadedPath, selectedEditor);

					// Clean up the VSIX file after successful installation
					try {
						await deleteFile(downloadedPath);
					} catch (error) {
						// Log but don't fail the installation if cleanup fails
						console.warn('Failed to delete VSIX file:', error);
					}

					setExtensionStatus(InstallerStatus.SUCCESS);
					setCurrentStep(ExtensionStep.COMPLETE);
					onComplete(true);
				} catch (error) {
					setExtensionStatus(InstallerStatus.ERROR);
					setExtensionError(errorToString(error));
					if (downloaded) {
						onComplete(true);
					} else {
						onComplete(false);
					}
				}
			};
			downloadAndInstall();
		}
	}, [currentStep, licenseKey, selectedEditor, onComplete]);

	const handleEditorSelect = (item: (typeof EDITOR_OPTIONS)[number]) => {
		setSelectedEditor(item.value);
		setCurrentStep(ExtensionStep.DOWNLOADING);
	};

	const renderStep = () => {
		switch (currentStep) {
			case ExtensionStep.SELECTING_EDITOR:
				return (
					<>
						<Text>Which editor do you use?</Text>
						<SelectInput items={EDITOR_OPTIONS} onSelect={handleEditorSelect} />
					</>
				);

			case ExtensionStep.DOWNLOADING:
				return (
					<>
						<Box>
							{extensionStatus === InstallerStatus.LOADING && (
								<Text>
									<Spinner />{' '}
								</Text>
							)}
							<Text dimColor>
								Downloading jxscout VSCode extension...
								{extensionStatus === InstallerStatus.SUCCESS && (
									<Text> ✅</Text>
								)}
								{extensionStatus === InstallerStatus.ERROR && <Text> ❌</Text>}
							</Text>
						</Box>
						{extensionStatus === InstallerStatus.ERROR && (
							<Text color="red">
								Error downloading extension: {extensionError}
							</Text>
						)}
					</>
				);

			case ExtensionStep.INSTALLING:
				return (
					<>
						<Box>
							{extensionStatus !== InstallerStatus.ERROR && (
								<Text>
									<Spinner />{' '}
								</Text>
							)}
							<Text dimColor>
								Installing jxscout extension in {selectedEditor}...
								{extensionStatus === InstallerStatus.SUCCESS && (
									<Text> ✅</Text>
								)}
								{extensionStatus === InstallerStatus.ERROR && <Text> ❌</Text>}
							</Text>
						</Box>
						{extensionStatus === InstallerStatus.ERROR && (
							<>
								<Box flexDirection="column" gap={1}>
									<Text color="red">
										Error installing extension: {extensionError}
									</Text>
									<Text color="yellow">
										Please try installing manually. Downloaded file is at:{' '}
										<Text bold>{extensionPath}</Text>
									</Text>
								</Box>
							</>
						)}
					</>
				);

			case ExtensionStep.COMPLETE:
				return (
					<Text>
						VSCode extension installation complete ✅
						{actualVersion && <Text> (version {actualVersion})</Text>}
					</Text>
				);

			default:
				return null;
		}
	};

	return (
		<Box flexDirection="column" gap={1}>
			<Text
				bold
			>{`${index + 1}. ${isUpdating ? 'Updating' : 'Installing'} jxscout VSCode extension...`}</Text>
			{renderStep()}
		</Box>
	);
};
