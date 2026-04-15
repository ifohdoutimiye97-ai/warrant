import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import solc from "solc";

type SolcError = {
  severity: "error" | "warning";
  formattedMessage: string;
};

type ContractArtifact = {
  contractName: string;
  sourceName: string;
  abi: unknown[];
  bytecode: string;
  deployedBytecode: string;
};

type CompileResult = Record<string, ContractArtifact>;

const rootDir = process.cwd();
const contractsDir = path.join(rootDir, "contracts");
const artifactsDir = path.join(rootDir, "artifacts", "contracts");

async function collectSources() {
  const files = (await readdir(contractsDir)).filter((file) => file.endsWith(".sol"));
  const sources: Record<string, { content: string }> = {};

  await Promise.all(
    files.map(async (file) => {
      const absolutePath = path.join(contractsDir, file);
      const content = await readFile(absolutePath, "utf8");
      sources[file] = { content };
    }),
  );

  return sources;
}

export async function compileContracts({ writeArtifacts = true } = {}): Promise<CompileResult> {
  const input = {
    language: "Solidity",
    sources: await collectSources(),
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
    contracts?: Record<
      string,
      Record<
        string,
        {
          abi: unknown[];
          evm: {
            bytecode: { object: string };
            deployedBytecode: { object: string };
          };
        }
      >
    >;
    errors?: SolcError[];
  };

  const errors = output.errors ?? [];
  const fatalErrors = errors.filter((error) => error.severity === "error");

  errors.forEach((error) => {
    const log = error.severity === "error" ? console.error : console.warn;
    log(error.formattedMessage);
  });

  if (fatalErrors.length > 0 || !output.contracts) {
    throw new Error("Contract compilation failed.");
  }

  const artifacts: CompileResult = {};

  for (const [sourceName, contracts] of Object.entries(output.contracts)) {
    for (const [contractName, contract] of Object.entries(contracts)) {
      const artifact: ContractArtifact = {
        contractName,
        sourceName,
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
      };

      artifacts[contractName] = artifact;

      if (writeArtifacts) {
        const targetDir = path.join(artifactsDir, sourceName);
        await mkdir(targetDir, { recursive: true });
        await writeFile(
          path.join(targetDir, `${contractName}.json`),
          `${JSON.stringify(artifact, null, 2)}\n`,
          "utf8",
        );
      }
    }
  }

  return artifacts;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  compileContracts()
    .then((artifacts) => {
      const names = Object.keys(artifacts);
      console.log(`Compiled ${names.length} contracts: ${names.join(", ")}`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exitCode = 1;
    });
}
