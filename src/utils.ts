import fs from 'fs';
import {spawn} from 'node:child_process';
import os from 'os';
import path from 'path';

export const getProgramPath = async (programName: string) => {
	const command = process.platform === 'win32' ? 'where.exe' : 'which';
	return runCommand(`${command} ${programName}`);
};

export type CommandResult =
	| {success: true; stdout: string; allPaths?: string[]}
	| {success: false; error: string; exitCode: number};

export const runCommand = async (command: string): Promise<CommandResult> => {
	return new Promise(resolve => {
		const [cmd, ...args] = command.split(' ');

		if (!cmd) {
			resolve({
				success: false,
				error: 'No command provided',
				exitCode: 1,
			});
			return;
		}

		const child = spawn(cmd, args, {
			env: process.env,
			shell: true,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';

		child.stdout?.on('data', (data: Buffer) => {
			stdout += data.toString();
		});

		child.stderr?.on('data', (data: Buffer) => {
			stderr += data.toString();
		});

		child.on('close', (code: number | null) => {
			if (code === 0) {
				resolve({
					success: true,
					stdout: stdout.trim(),
				});
			} else {
				const enhancedError = stderr.trim() || 'Command failed';
				resolve({
					success: false,
					error: enhancedError,
					exitCode: code || 1,
				});
			}
		});

		child.on('error', (error: Error) => {
			resolve({
				success: false,
				error: error.message || 'Unknown error occurred',
				exitCode: 1,
			});
		});
	});
};

export const isAlreadyInstalled = () => {
	const homeDir = os.homedir();
	const jxscoutDir = path.join(homeDir, '.jxscout');
	const licensePath = path.join(jxscoutDir, '.license');
	const proPath = path.join(jxscoutDir, '.pro');

	return fs.existsSync(licensePath) || fs.existsSync(proPath);
};

export const readLicenseKey = (): string | null => {
	const homeDir = os.homedir();
	const licensePath = path.join(homeDir, '.jxscout', '.license');

	if (!fs.existsSync(licensePath)) {
		return null;
	}

	try {
		return fs.readFileSync(licensePath, 'utf8').trim();
	} catch (error) {
		return null;
	}
};

export const writeLicenseKey = async (licenseKey: string): Promise<void> => {
	const homeDir = os.homedir();
	const jxscoutDir = path.join(homeDir, '.jxscout');
	const licensePath = path.join(jxscoutDir, '.license');

	try {
		await fs.promises.mkdir(jxscoutDir, {recursive: true});
		await fs.promises.writeFile(licensePath, licenseKey, 'utf8');
	} catch (error) {
		throw new Error(`Failed to write license key: ${errorToString(error)}`);
	}
};

export const deleteLicenseKey = async (): Promise<void> => {
	const homeDir = os.homedir();
	const licensePath = path.join(homeDir, '.jxscout', '.license');

	try {
		if (fs.existsSync(licensePath)) {
			await fs.promises.unlink(licensePath);
		}
	} catch (error) {
		throw new Error(`Failed to delete license key: ${errorToString(error)}`);
	}
};

export const createProFile = async (): Promise<void> => {
	const homeDir = os.homedir();
	const jxscoutDir = path.join(homeDir, '.jxscout');
	const proPath = path.join(jxscoutDir, '.pro');

	try {
		await fs.promises.mkdir(jxscoutDir, {recursive: true});
		await fs.promises.writeFile(proPath, '', 'utf8');
	} catch (error) {
		throw new Error(`Failed to create .pro file: ${errorToString(error)}`);
	}
};

export const checkBunInstalled = async () => {
	return runCommand('bun --version');
};

export const installBun = async () => {
	return runCommand('npm install -g bun');
};

export const errorToString = (error: unknown) => {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'object' && error !== null) {
		return JSON.stringify(error);
	}
	return String(error);
};

export const getJXScoutPath = async () => {
	const result = await getProgramPath('jxscout');
	if (result.success) {
		const paths = result.stdout
			.split('\n')
			.map(path => path.trim())
			.filter(path => path.length > 0);
		if (paths.length > 0) {
			return {
				success: true,
				stdout: paths[0],
				allPaths: paths,
			};
		}
	}
	return result;
};

export const getJXScoutDirectory = async () => {
	const homeDir = os.homedir();
	return path.join(homeDir, '.jxscout');
};

export const hasJXScoutDirectory = async (): Promise<boolean> => {
	try {
		const directory = await getJXScoutDirectory();
		await fs.promises.stat(directory);

		const files = await fs.promises.readdir(directory);
		const nonLicenseFiles = files.filter(file => file !== '.license');

		return nonLicenseFiles.length > 0;
	} catch {
		return false;
	}
};

export const getJXScoutHomeDirectory = async () => {
	const homeDir = os.homedir();
	return path.join(homeDir, 'jxscout');
};

export const hasJXScoutHomeDirectory = async (): Promise<boolean> => {
	try {
		const directory = await getJXScoutHomeDirectory();
		await fs.promises.stat(directory);
		return true;
	} catch {
		return false;
	}
};

export const renameDirectory = async (
	oldPath: string,
	newPath: string,
): Promise<string> => {
	let counter = 0;
	let finalPath = newPath;

	while (true) {
		try {
			await fs.promises.access(finalPath);
			counter++;
			finalPath = `${newPath}.${counter}`;
		} catch {
			break;
		}
	}

	try {
		await fs.promises.rename(oldPath, finalPath);
		console.log(`Renamed ${oldPath} → ${finalPath}`);
		return finalPath;
	} catch (err) {
		console.error('Error renaming directory:', err);
		throw err;
	}
};

export const deleteFile = async (file: string): Promise<void> => {
	return fs.promises.unlink(file);
};

export const getCurrentDirectory = () => {
	return process.cwd();
};

export const downloadProxyExtension = async (
	proxy: 'caido' | 'burp',
	downloadPath: string,
) => {
	return downloadLatestRelease(
		'francisconeves97',
		proxy === 'caido' ? 'jxscout-caido' : 'jxscout-burp',
		downloadPath,
	);
};

interface GitHubRelease {
	assets: Array<{
		name: string;
		browser_download_url: string;
	}>;
}

export async function downloadLatestRelease(
	owner: string,
	repo: string,
	outputDir: string,
): Promise<string> {
	// Get latest release metadata
	const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
	const response = await fetch(apiUrl);

	if (!response.ok) {
		throw new Error(`Failed to fetch release info: ${response.statusText}`);
	}

	const release: GitHubRelease = await response.json();

	if (!release.assets || release.assets.length === 0) {
		throw new Error('No assets found in the latest release.');
	}

	// Take the first asset (or adjust logic for multiple assets)
	const asset = release.assets[0];
	if (!asset) {
		throw new Error('No valid asset found in the latest release.');
	}

	const downloadUrl = asset.browser_download_url;

	// Ensure output directory exists
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, {recursive: true});
	}

	// Output file path
	const filePath = path.join(outputDir, asset.name);

	// Download asset
	const assetResponse = await fetch(downloadUrl);
	if (!assetResponse.ok) {
		throw new Error(`Failed to download asset: ${assetResponse.statusText}`);
	}

	if (!assetResponse.body) {
		throw new Error('Asset response body is null.');
	}

	const fileStream = fs.createWriteStream(filePath);

	try {
		// Convert ReadableStream to Node.js readable stream
		const reader = assetResponse.body.getReader();
		const pump = async () => {
			try {
				while (true) {
					const {done, value} = await reader.read();
					if (done) {
						fileStream.end();
						break;
					}
					fileStream.write(value);
				}
			} catch (error) {
				fileStream.destroy();
				throw error;
			}
		};

		await new Promise<void>((resolve, reject) => {
			fileStream.on('error', reject);
			fileStream.on('finish', resolve);
			pump().catch(reject);
		});
	} catch (error) {
		// Clean up the file if download failed
		try {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		} catch (cleanupError) {
			// Ignore cleanup errors
		}
		throw error;
	}

	return filePath;
}
