import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PRINT_MS = 30_000

const WINDOWS_RAW_PRINT_PS1 = `
param(
  [string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath
)

$ErrorActionPreference = 'Stop'

if (-not $PrinterName) {
  $PrinterName = (Get-CimInstance -ClassName Win32_Printer | Where-Object { $_.Default }).Name
  if (-not $PrinterName) {
    throw 'No printer found. Pick one in Settings.'
  }
}

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public static class SalesProRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static void Print(string printer, string path) {
    IntPtr hPrinter;
    if (!OpenPrinter(printer, out hPrinter, IntPtr.Zero)) {
      throw new Exception("Could not open the printer.");
    }
    try {
      var di = new DOCINFOW();
      di.pDocName = "Sales Pro receipt";
      di.pDataType = "RAW";
      if (!StartDocPrinter(hPrinter, 1, di)) {
        throw new Exception("Could not start the print job.");
      }
      try {
        if (!StartPagePrinter(hPrinter)) {
          throw new Exception("Could not start the print page.");
        }
        try {
          byte[] bytes = File.ReadAllBytes(path);
          IntPtr p = Marshal.AllocHGlobal(bytes.Length);
          try {
            Marshal.Copy(bytes, 0, p, bytes.Length);
            int written;
            if (!WritePrinter(hPrinter, p, bytes.Length, out written) || written != bytes.Length) {
              throw new Exception("Could not send the receipt to the printer.");
            }
          } finally {
            Marshal.FreeHGlobal(p);
          }
        } finally {
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
"@

[SalesProRawPrinter]::Print($PrinterName, $FilePath)
`.trim()

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Printing timed out. Check the printer.'))
    }, PRINT_MS)

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          stderr.trim() || 'Could not print the receipt. Check the printer in Settings.',
        ),
      )
    })
  })
}

function powershellPath(): string {
  const root = process.env['SystemRoot'] ?? 'C:\\Windows'
  return join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

async function withJobFile(
  data: Uint8Array,
  send: (filePath: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'sales-pro-print-'))
  const filePath = join(dir, 'receipt.bin')
  try {
    await writeFile(filePath, data)
    await send(filePath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function printRawWindows(printerName: string, data: Uint8Array): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'sales-pro-print-'))
  const scriptPath = join(dir, 'print.ps1')
  const filePath = join(dir, 'receipt.bin')
  try {
    await writeFile(scriptPath, WINDOWS_RAW_PRINT_PS1, 'utf8')
    await writeFile(filePath, data)
    await run(powershellPath(), [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-PrinterName',
      printerName,
      '-FilePath',
      filePath,
    ])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function printRawUnix(printerName: string, data: Uint8Array): Promise<void> {
  await withJobFile(data, (filePath) => {
    const args = ['-o', 'raw']
    if (printerName) args.push('-d', printerName)
    args.push(filePath)
    return run('lp', args)
  })
}

/** Bypass GDI page scaling by writing ESC/POS as a RAW spooler job. */
export async function printRaw(printerName: string, data: Uint8Array): Promise<void> {
  if (process.platform === 'win32') {
    await printRawWindows(printerName, data)
    return
  }
  if (process.platform === 'darwin' || process.platform === 'linux') {
    await printRawUnix(printerName, data)
    return
  }
  throw new Error('Printing is not supported on this system.')
}
