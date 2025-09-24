import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import {useEffect, useState} from 'react';
import {checkBunInstalled, installBun} from '../../utils.js';

enum BunStep {
	CHECKING,
	ALREADY_INSTALLED,
	INSTALLING,
	VERIFYING,
	COMPLETE,
	ERROR,
}

export const BunInstallerStep = ({
	index,
	onComplete,
}: {
	index: number;
	onComplete: (success: boolean) => void;
}) => {
	const [currentStep, setCurrentStep] = useState<BunStep>(BunStep.CHECKING);
	const [installError, setInstallError] = useState<string | null>(null);

	useEffect(() => {
		if (currentStep === BunStep.CHECKING) {
			const runCheck = async () => {
				const result = await checkBunInstalled();
				if (result.success) {
					setCurrentStep(BunStep.ALREADY_INSTALLED);
					onComplete(true);
				} else {
					setCurrentStep(BunStep.INSTALLING);
				}
			};
			runCheck();
		}
	}, [currentStep]);

	useEffect(() => {
		if (currentStep === BunStep.INSTALLING) {
			const runInstall = async () => {
				const result = await installBun();
				if (result.success) {
					setCurrentStep(BunStep.VERIFYING);
				} else {
					setInstallError(result.error);
					setCurrentStep(BunStep.ERROR);
					onComplete(false);
				}
			};
			runInstall();
		}
	}, [currentStep]);

	useEffect(() => {
		if (currentStep === BunStep.VERIFYING) {
			const verifyInstallation = async () => {
				const result = await checkBunInstalled();
				if (result.success) {
					setCurrentStep(BunStep.COMPLETE);
					onComplete(true);
				} else {
					setInstallError(
						'Tried to install bun using npm install -g bun, but bun still not in path. Please follow the instructions on https://bun.sh/ to install bun manually.',
					);
					setCurrentStep(BunStep.ERROR);
					onComplete(false);
				}
			};
			verifyInstallation();
		}
	}, [currentStep]);

	const renderStep = () => {
		switch (currentStep) {
			case BunStep.CHECKING:
				return (
					<>
						<Text>
							<Spinner /> Checking if bun is installed...
						</Text>
					</>
				);

			case BunStep.ALREADY_INSTALLED:
				return (
					<>
						<Text>Bun is installed ✅</Text>
					</>
				);

			case BunStep.INSTALLING:
				return (
					<>
						<Text>
							<Spinner /> Installing bun:{' '}
							<Text dimColor>npm install -g bun</Text>
						</Text>
					</>
				);

			case BunStep.VERIFYING:
				return (
					<>
						<Text>
							<Spinner /> Verifying bun installation...
						</Text>
					</>
				);

			case BunStep.COMPLETE:
				return (
					<>
						<Text>Bun installed successfully ✅</Text>
					</>
				);

			case BunStep.ERROR:
				return (
					<>
						<Text>Error installing bun ❌</Text>
						<Text color="red">Error: </Text>
						<Text bold>{installError}</Text>
					</>
				);

			default:
				return null;
		}
	};

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>{`${index + 1}. Setting up bun...`}</Text>
			{renderStep()}
		</Box>
	);
};
