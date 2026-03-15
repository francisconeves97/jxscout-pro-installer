import fs, {createReadStream, createWriteStream} from 'fs';
import {Box, Text, useApp} from 'ink';
import os from 'os';
import path from 'path';
import {useEffect, useState} from 'react';
import {pipeline} from 'stream/promises';
import {extract} from 'tar';
import {createGunzip} from 'zlib';
import {deleteLicenseKey, errorToString, runCommand} from '../../utils.js';
import {Spinner} from '../spinner.js';
import {InstallerStatus} from './index.js';

const DEPRECATED_VERSION = '2.0.0';

export enum ReleaseType {
	LINUX_386 = 'linux-386',
	LINUX_AMD64 = 'linux-amd64',
	LINUX_ARM64 = 'linux-arm64',
	MACOS_AMD64 = 'macos-amd64',
	MACOS_ARM64 = 'macos-arm64',
	WINDOWS_AMD64 = 'windows-amd64',
	WINDOWS_ARM64 = 'windows-arm64',
	VSCODE_EXTENSION = 'vscode-extension',
}

export enum Version {
	LATEST = 'latest',
	STABLE = 'stable',
	BETA = 'beta',
}

const DEFAULT_DOWNLOAD_PATH = path.join(os.homedir(), '.jxscout', 'bin');

enum CLIStep {
	DOWNLOADING,
	EXTRACTING,
	INSTALLING,
	COMPLETE,
}

const getReleaseType = (): ReleaseType => {
	const platform = os.platform();
	const arch = os.arch();

	if (platform === 'darwin') {
		return arch === 'arm64' ? ReleaseType.MACOS_ARM64 : ReleaseType.MACOS_AMD64;
	}

	if (platform === 'win32') {
		return arch === 'arm64'
			? ReleaseType.WINDOWS_ARM64
			: ReleaseType.WINDOWS_AMD64;
	}

	if (platform === 'linux') {
		if (arch === 'arm64') return ReleaseType.LINUX_ARM64;
		if (arch === 'x64') return ReleaseType.LINUX_AMD64;
		return ReleaseType.LINUX_386;
	}

	throw new Error(`Unsupported platform: ${platform} ${arch}`);
};

const downloadCLI = async (
	version: string = 'latest',
	licenseKey: string = '',
	releaseType: ReleaseType = getReleaseType(),
	downloadPath: string = DEFAULT_DOWNLOAD_PATH,
): Promise<{archivePath: string; version: string; deprecated?: boolean}> => {
	const params = new URLSearchParams({
		version,
		type: releaseType,
	});

	if (licenseKey) {
		params.append('licenseKey', licenseKey);
	}

	const response = await fetch(`https://jxscout.app/api/download?${params}`, {
		method: 'GET',
	});

	if (response.status === 401) {
		throw new Error('Invalid license key');
	}

	if (!response.ok) {
		throw new Error(`Failed to get download URL: ${response.statusText}`);
	}

	const {downloadUrl, version: returnedVersion} = (await response.json()) as {
		downloadUrl: string;
		version: string;
	};

	if (returnedVersion === DEPRECATED_VERSION) {
		return {archivePath: '', version: returnedVersion, deprecated: true};
	}

	if (!fs.existsSync(downloadPath)) {
		fs.mkdirSync(downloadPath, {recursive: true});
	}

	const fileName = `jxscout-${releaseType}.tar.gz`;
	const filePath = path.join(downloadPath, fileName);

	const downloadResponse = await fetch(downloadUrl);
	if (!downloadResponse.ok) {
		throw new Error(
			`Failed to download binary: ${downloadResponse.statusText}`,
		);
	}

	if (!downloadResponse.body) {
		throw new Error('Download response body is null');
	}

	const fileStream = createWriteStream(filePath);
	await pipeline(downloadResponse.body as any, fileStream);

	return {archivePath: filePath, version: returnedVersion, deprecated: false};
};

const extractAndInstall = async (
	archivePath: string,
	version: string,
	downloadPath: string,
): Promise<string> => {
	const extractPath = path.join(downloadPath, 'jxscout-extracted');

	if (fs.existsSync(extractPath)) {
		fs.rmSync(extractPath, {recursive: true, force: true});
	}

	fs.mkdirSync(extractPath, {recursive: true});

	await pipeline(
		createReadStream(archivePath),
		createGunzip(),
		extract({cwd: extractPath}),
	);

	const extractedFiles = fs.readdirSync(extractPath);
	const binaryFile = extractedFiles.find(
		file => file === 'jxscout' || file === 'jxscout.exe',
	);

	if (!binaryFile) {
		throw new Error('Could not find jxscout binary in extracted files');
	}

	const binaryPath = path.join(extractPath, binaryFile);
	const finalBinaryPath = path.join(extractPath, 'jxscout');

	if (binaryFile !== 'jxscout') {
		fs.copyFileSync(binaryPath, finalBinaryPath);
	}

	fs.chmodSync(finalBinaryPath, 0o755);

	const packageJson = {
		name: 'jxscout-pro',
		version,
		bin: './jxscout',
	};

	const packageJsonPath = path.join(extractPath, 'package.json');
	fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

	const res = await runCommand(`npm install -g "${extractPath}"`);
	if (!res.success) {
		throw new Error(`Failed to install jxscout: ${res.error}`);
	}

	fs.unlinkSync(archivePath);

	return finalBinaryPath;
};

export const DownloadCLIStep = ({
	index,
	licenseKey,
	onComplete,
	cliVersion = 'latest',
	isUpdating = false,
	onVersionUpdate,
}: {
	index: number;
	licenseKey: string;
	onComplete: (success: boolean) => void;
	cliVersion?: string;
	isUpdating?: boolean;
	onVersionUpdate?: (version: string) => void;
}) => {
	const [currentStep, setCurrentStep] = useState<CLIStep>(CLIStep.DOWNLOADING);
	const [downloadStatus, setDownloadStatus] = useState<InstallerStatus | null>(
		null,
	);
	const [downloadError, setDownloadError] = useState<string | null>(null);
	const [actualVersion, setActualVersion] = useState<string | null>(null);
	const [isDeprecated, setIsDeprecated] = useState(false);
	const {exit} = useApp();

	useEffect(() => {
		if (currentStep === CLIStep.DOWNLOADING) {
			const downloadAndInstall = async () => {
				setDownloadStatus(InstallerStatus.LOADING);
				try {
					const releaseType = getReleaseType();
					const {archivePath, version, deprecated} = await downloadCLI(
						cliVersion,
						licenseKey,
						releaseType,
						DEFAULT_DOWNLOAD_PATH,
					);

					if (deprecated) {
						setIsDeprecated(true);
						setTimeout(() => {
							exit();
						}, 100);
						return;
					}

					setActualVersion(version);
					onVersionUpdate?.(version);
					setCurrentStep(CLIStep.EXTRACTING);
					await extractAndInstall(archivePath, version, DEFAULT_DOWNLOAD_PATH);

					setDownloadStatus(InstallerStatus.SUCCESS);
					setCurrentStep(CLIStep.COMPLETE);
					onComplete(true);
				} catch (error) {
					setDownloadStatus(InstallerStatus.ERROR);
					setDownloadError(errorToString(error));

					// Delete the license key file if download fails
					try {
						await deleteLicenseKey();
					} catch (deleteError) {
						console.error('Failed to delete license key:', deleteError);
					}

					onComplete(false);
				}
			};
			downloadAndInstall();
		}
	}, [currentStep, licenseKey, onComplete]);

	if (isDeprecated) {
		const downloadUrl = `https://jxscout.app/v2/download?licenseKey=${encodeURIComponent(licenseKey)}`;
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="yellow">
					This installer has been deprecated.
				</Text>
				<Text>jxscout pro v2 is now available! Please download it from:</Text>
				<Text bold color="cyan">
					{downloadUrl}
				</Text>
			</Box>
		);
	}

	const renderStep = () => {
		switch (currentStep) {
			case CLIStep.DOWNLOADING:
				return (
					<>
						<Box>
							{downloadStatus === InstallerStatus.LOADING && (
								<Text>
									<Spinner />{' '}
								</Text>
							)}
							<Text dimColor>
								Downloading jxscout CLI for {getReleaseType()}{' '}
								{downloadStatus === InstallerStatus.SUCCESS && <Text>✅</Text>}
								{downloadStatus === InstallerStatus.ERROR && <Text>❌</Text>}
							</Text>
						</Box>
						{downloadStatus === InstallerStatus.ERROR && (
							<Text color="red">Error downloading CLI: {downloadError}</Text>
						)}
					</>
				);

			case CLIStep.EXTRACTING:
				return (
					<>
						<Box>
							{downloadStatus !== InstallerStatus.ERROR && (
								<Text>
									<Spinner />{' '}
								</Text>
							)}
							<Text dimColor>
								Extracting and installing jxscout CLI globally...
								{downloadStatus === InstallerStatus.SUCCESS && <Text> ✅</Text>}
								{downloadStatus === InstallerStatus.ERROR && <Text> ❌</Text>}
							</Text>
						</Box>
						{downloadStatus === InstallerStatus.ERROR && (
							<Text color="red">
								Error extracting/installing CLI: {downloadError}
							</Text>
						)}
					</>
				);

			case CLIStep.COMPLETE:
				return (
					<Text>
						CLI installation complete ✅
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
			>{`${index + 1}. ${isUpdating ? 'Updating' : 'Setting up'} jxscout CLI...`}</Text>
			{renderStep()}
		</Box>
	);
};
