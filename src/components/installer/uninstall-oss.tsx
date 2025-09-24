import {Box, Text} from 'ink';
import {useEffect, useState} from 'react';
import {
	deleteFile,
	errorToString,
	getJXScoutDirectory,
	getJXScoutHomeDirectory,
	getJXScoutPath,
	hasJXScoutDirectory,
	hasJXScoutHomeDirectory,
	renameDirectory,
} from '../../utils.js';
import {Spinner} from '../spinner.js';

enum UninstallStep {
	CHECKING,
	REMOVING_BINARIES,
	REMOVING_DIRECTORY,
	COMPLETE,
	ERROR,
}

interface UninstallState {
	hasExistingBinary: boolean;
	hasExistingDirectory: boolean;
	hasExistingHomeDirectory: boolean;
	binaryPaths: string[];
	backupDirectoryPath: string | null;
	backupHomeDirectoryPath: string | null;
	error: string | null;
}

export const UninstallOSSVersionStep = ({
	index,
	onComplete,
}: {
	index: number;
	onComplete: (success: boolean) => void;
}) => {
	const [currentStep, setCurrentStep] = useState<UninstallStep>(
		UninstallStep.CHECKING,
	);
	const [state, setState] = useState<UninstallState>({
		hasExistingBinary: false,
		hasExistingDirectory: false,
		hasExistingHomeDirectory: false,
		binaryPaths: [],
		backupDirectoryPath: null,
		backupHomeDirectoryPath: null,
		error: null,
	});

	useEffect(() => {
		if (currentStep === UninstallStep.CHECKING) {
			const runChecks = async () => {
				try {
					const [directoryExists, homeDirectoryExists, binaryResult] =
						await Promise.all([
							hasJXScoutDirectory(),
							hasJXScoutHomeDirectory(),
							getJXScoutPath(),
						]);

					const binaryPaths = binaryResult.success
						? binaryResult.allPaths ||
							(binaryResult.stdout ? [binaryResult.stdout.trim()] : [])
						: [];

					setState(prev => ({
						...prev,
						hasExistingDirectory: directoryExists,
						hasExistingHomeDirectory: homeDirectoryExists,
						hasExistingBinary: binaryResult.success,
						binaryPaths,
					}));

					if (binaryResult.success || directoryExists || homeDirectoryExists) {
						setCurrentStep(UninstallStep.REMOVING_BINARIES);
					} else {
						setCurrentStep(UninstallStep.COMPLETE);
						onComplete(true);
					}
				} catch (error) {
					setState(prev => ({
						...prev,
						error: errorToString(error),
					}));
					setCurrentStep(UninstallStep.ERROR);
					onComplete(false);
				}
			};
			runChecks();
		}
	}, [currentStep]);

	useEffect(() => {
		if (
			currentStep === UninstallStep.REMOVING_BINARIES &&
			state.hasExistingBinary &&
			state.binaryPaths.length > 0
		) {
			const removeBinaries = async () => {
				try {
					await Promise.all(state.binaryPaths.map(path => deleteFile(path)));
					setCurrentStep(UninstallStep.REMOVING_DIRECTORY);
				} catch (error) {
					setState(prev => ({
						...prev,
						error: errorToString(error),
					}));
					setCurrentStep(UninstallStep.ERROR);
					onComplete(false);
				}
			};
			removeBinaries();
		} else if (currentStep === UninstallStep.REMOVING_BINARIES) {
			setCurrentStep(UninstallStep.REMOVING_DIRECTORY);
		}
	}, [currentStep, state.hasExistingBinary, state.binaryPaths]);

	useEffect(() => {
		if (
			currentStep === UninstallStep.REMOVING_DIRECTORY &&
			(state.hasExistingDirectory || state.hasExistingHomeDirectory)
		) {
			const removeDirectories = async () => {
				try {
					const backupPaths: string[] = [];

					if (state.hasExistingDirectory) {
						const jxscoutDirectory = await getJXScoutDirectory();
						const backupPath = await renameDirectory(
							jxscoutDirectory,
							`${jxscoutDirectory}.bak`,
						);
						backupPaths.push(backupPath);
					}

					if (state.hasExistingHomeDirectory) {
						const jxscoutHomeDirectory = await getJXScoutHomeDirectory();
						const backupPath = await renameDirectory(
							jxscoutHomeDirectory,
							`${jxscoutHomeDirectory}.bak`,
						);
						backupPaths.push(backupPath);
					}

					setState(prev => ({
						...prev,
						backupDirectoryPath: state.hasExistingDirectory
							? backupPaths[0] || null
							: null,
						backupHomeDirectoryPath: state.hasExistingHomeDirectory
							? backupPaths[state.hasExistingDirectory ? 1 : 0] || null
							: null,
					}));
					setCurrentStep(UninstallStep.COMPLETE);
					onComplete(true);
				} catch (error) {
					setState(prev => ({
						...prev,
						error: errorToString(error),
					}));
					setCurrentStep(UninstallStep.ERROR);
					onComplete(false);
				}
			};
			removeDirectories();
		} else if (currentStep === UninstallStep.REMOVING_DIRECTORY) {
			setCurrentStep(UninstallStep.COMPLETE);
			onComplete(true);
		}
	}, [currentStep, state.hasExistingDirectory, state.hasExistingHomeDirectory]);

	const renderStep = () => {
		switch (currentStep) {
			case UninstallStep.CHECKING:
				return (
					<>
						<Text>
							<Spinner /> Checking if open source version is installed...
						</Text>
					</>
				);

			case UninstallStep.REMOVING_BINARIES:
				return (
					<>
						{state.hasExistingBinary ? (
							<Box flexDirection="column" gap={1}>
								<Text>
									<Spinner /> Detected existing installation of jxscout.
									Removing{' '}
									{state.binaryPaths.length > 1 ? 'binaries' : 'binary'}...
								</Text>
								{state.binaryPaths.map((path, index) => (
									<Text key={index} dimColor>
										{path}
									</Text>
								))}
							</Box>
						) : (
							<Text>No existing installation of jxscout found ✅</Text>
						)}
					</>
				);

			case UninstallStep.REMOVING_DIRECTORY:
				return (
					<>
						{state.hasExistingDirectory || state.hasExistingHomeDirectory ? (
							<Box flexDirection="column" gap={1}>
								<Text>
									<Spinner /> Detected existing jxscout directories. Backing
									them up before removing...
								</Text>
								{state.hasExistingDirectory && (
									<Text dimColor>~/.jxscout directory will be backed up</Text>
								)}
								{state.hasExistingHomeDirectory && (
									<Text dimColor>~/jxscout directory will be backed up</Text>
								)}
								{state.backupDirectoryPath && (
									<Text dimColor>
										~/.jxscout backed up to: {state.backupDirectoryPath}
									</Text>
								)}
								{state.backupHomeDirectoryPath && (
									<Text dimColor>
										~/jxscout backed up to: {state.backupHomeDirectoryPath}
									</Text>
								)}
							</Box>
						) : (
							<Text>No existing jxscout directories found ✅</Text>
						)}
					</>
				);

			case UninstallStep.COMPLETE:
				return (
					<>
						<Text>Open source version cleanup complete ✅</Text>
						{state.hasExistingBinary && (
							<Text>
								Removed {state.binaryPaths.length > 1 ? 'binaries' : 'binary'}:
								{state.binaryPaths.map((path, index) => (
									<Text key={index} dimColor>
										{' '}
										{path}
									</Text>
								))}
							</Text>
						)}
						{state.hasExistingDirectory && state.backupDirectoryPath && (
							<Text>
								Backed up ~/.jxscout directory to:{' '}
								<Text bold>{state.backupDirectoryPath}</Text>
							</Text>
						)}
						{state.hasExistingHomeDirectory &&
							state.backupHomeDirectoryPath && (
								<Text>
									Backed up ~/jxscout directory to:{' '}
									<Text bold>{state.backupHomeDirectoryPath}</Text>
								</Text>
							)}
						{!state.hasExistingBinary &&
							!state.hasExistingDirectory &&
							!state.hasExistingHomeDirectory && (
								<Text>
									No existing installation found - nothing to clean up
								</Text>
							)}
					</>
				);

			case UninstallStep.ERROR:
				return (
					<>
						<Text color="red">Error during cleanup: {state.error}</Text>
					</>
				);

			default:
				return null;
		}
	};

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>{`${index + 1}. Cleaning up open source version...`}</Text>
			{renderStep()}
		</Box>
	);
};
