import { spawn } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
}

interface RunCommandOptions {
  cwd?: string;
  timeoutMs?: number;
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;

    const timeout =
      options.timeoutMs && options.timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, options.timeoutMs)
        : null;

    child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("error", (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (timedOut) {
        reject(
          new Error(
            `Command timed out after ${options.timeoutMs}ms: ${command}`,
          ),
        );
        return;
      }

      if (code !== 0) {
        reject(
          new Error(
            `Command failed (${code ?? signal ?? "unknown"}): ${command}\n${trimOutput(stderr || stdout)}`,
          ),
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function trimOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length <= 1200) {
    return trimmed;
  }

  return `...${trimmed.slice(-1200)}`;
}
