#!/usr/bin/env node
import {render} from 'ink';
import meow from 'meow';
import {App} from './app.js';

const cli = meow(
	`
	Usage
	  $ jxscout-pro-installer [options]

	Options
	  --cli-version <version>     Version of the CLI to install (default: latest)
	  --vscode-ext-version <version>  Version of the VSCode extension to install (default: latest)

	Examples
	  $ jxscout-pro-installer
	  $ jxscout-pro-installer --cli-version 1.2.3 --vscode-ext-version 1.1.0
`,
	{
		importMeta: import.meta,
		flags: {
			cliVersion: {
				type: 'string',
				default: 'latest',
			},
			vscodeExtVersion: {
				type: 'string',
				default: 'latest',
			},
		},
	},
);

render(
	<App
		cliVersion={cli.flags.cliVersion}
		vscodeExtVersion={cli.flags.vscodeExtVersion}
	/>,
);
