import { promises as fs } from 'node:fs';
import path from 'node:path';

type CommandName =
  | 'process-placeholders'
  | 'validate-order'
  | 'list-templates'
  | 'extract-placeholders'
  | 'help';

type ArgMap = Record<string, string | undefined>;

interface PlaceholderPayloadEntry {
  mini_prompt?: string;
  [key: string]: unknown;
}

interface PlaceholderPayload {
  [placeholderId: string]: PlaceholderPayloadEntry;
}

interface ProcessPlaceholdersResult {
  ok: boolean;
  orderId: string;
  filesProcessed: number;
  filesModified: number;
  filesProcessedList: string[];
  filesModifiedList: string[];
}

const SUPPORTED_CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.md',
]);

const PLACEHOLDER_PATTERN = (placeholderId: string): RegExp =>
  new RegExp(`/\\*\\*\\s*${placeholderId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\*\\*/`, 'g');

const TEMPLATE_PLACEHOLDER_PATTERN = /\{\{(PLACEHOLDER_[A-Z0-9_]+)\}\}/g;
const COMMENT_PLACEHOLDER_PATTERN = /\/\*\*\s*(PLACEHOLDER_[A-Z0-9_]+)\s*\*\*\//g;

async function walkWorkspace(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith('.')) {
        return;
      }

      const entryPath = path.join(root, entry.name);

      if (entry.isDirectory()) {
        const childFiles = await walkWorkspace(entryPath);
        files.push(...childFiles);
      } else {
        files.push(entryPath);
      }
    }),
  );

  return files;
}

async function processPlaceholders(
  orderId: string,
  placeholderJsonPath: string,
  workspacePath: string,
): Promise<ProcessPlaceholdersResult> {
  const placeholderPayloadRaw = await fs.readFile(placeholderJsonPath, 'utf-8');
  const placeholderPayload: PlaceholderPayload = JSON.parse(placeholderPayloadRaw);

  const absoluteWorkspace = path.resolve(workspacePath);
  const files = await walkWorkspace(absoluteWorkspace);

  const filesProcessed: string[] = [];
  const filesModified: string[] = [];

  for (const filePath of files) {
    const extension = path.extname(filePath);
    const relativePath = path.relative(absoluteWorkspace, filePath);

    if (!SUPPORTED_CODE_EXTENSIONS.has(extension)) {
      continue;
    }

    const originalContent = await fs.readFile(filePath, 'utf-8');
    let updatedContent = originalContent;

    for (const [placeholderId, placeholderInfo] of Object.entries(placeholderPayload)) {
      const pattern = PLACEHOLDER_PATTERN(placeholderId);

      if (pattern.test(updatedContent)) {
        const miniPrompt =
          placeholderInfo?.mini_prompt ?? `Implement ${placeholderId.toLowerCase().replace(/_/g, ' ')}`;
        const replacement = `/** agent: ${miniPrompt} **/\n/** ${placeholderId} **/`;
        updatedContent = updatedContent.replace(pattern, replacement);
      }
    }

    if (updatedContent !== originalContent) {
      await fs.writeFile(filePath, updatedContent, 'utf-8');
      filesModified.push(relativePath);
    }

    filesProcessed.push(relativePath);
  }

  return {
    ok: true,
    orderId,
    filesProcessed: filesProcessed.length,
    filesModified: filesModified.length,
    filesProcessedList: filesProcessed,
    filesModifiedList: filesModified,
  };
}

interface OrderValidationResult {
  ok: boolean;
  errors?: string[];
}

async function validateOrder(orderFile: string): Promise<OrderValidationResult> {
  const raw = await fs.readFile(orderFile, 'utf-8');
  const orderData = JSON.parse(raw) as Record<string, unknown>;

  const errors: string[] = [];

  if (typeof orderData.id !== 'string' || orderData.id.trim().length === 0) {
    errors.push('Missing required field: id');
  }

  if (typeof orderData.factory !== 'string' || orderData.factory.trim().length === 0) {
    errors.push('Missing required field: factory');
  }

  if ('placeholder_payload' in orderData) {
    const payload = orderData.placeholder_payload as PlaceholderPayload | unknown;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      errors.push('placeholder_payload must be a dictionary');
    } else {
      for (const [placeholderId, value] of Object.entries(payload as PlaceholderPayload)) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push(`placeholder_payload[${placeholderId}] must be a dictionary`);
          continue;
        }

        if (!('mini_prompt' in value) || typeof value.mini_prompt !== 'string') {
          errors.push(`placeholder_payload[${placeholderId}] missing 'mini_prompt'`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

interface TemplateDescriptor {
  name: string;
  path: string;
}

async function listTemplates(factoryPath: string): Promise<TemplateDescriptor[]> {
  const entries = await fs.readdir(factoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => ({
      name: entry.name,
      path: path.join(factoryPath, entry.name),
    }));
}

interface ExtractedPlaceholderFile {
  path: string;
  placeholders: string[];
}

async function extractPlaceholders(templatePath: string): Promise<ExtractedPlaceholderFile[]> {
  const absoluteTemplatePath = path.resolve(templatePath);
  const files = await walkWorkspace(absoluteTemplatePath);
  const results: ExtractedPlaceholderFile[] = [];

  for (const filePath of files) {
    const extension = path.extname(filePath);
    if (!(filePath.endsWith('.template') || SUPPORTED_CODE_EXTENSIONS.has(extension))) {
      continue;
    }

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn(`Unable to read ${filePath}:`, error);
      continue;
    }

    const placeholders = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = TEMPLATE_PLACEHOLDER_PATTERN.exec(content))) {
      placeholders.add(match[1]);
    }

    while ((match = COMMENT_PLACEHOLDER_PATTERN.exec(content))) {
      placeholders.add(match[1]);
    }

    if (placeholders.size > 0) {
      results.push({
        path: path.relative(absoluteTemplatePath, filePath),
        placeholders: Array.from(placeholders),
      });
    }
  }

  return results;
}

function parseArgs(argv: string[]): [CommandName, ArgMap] {
  const [, , rawCommand, ...rest] = argv;
  const command = (rawCommand ?? 'help') as CommandName;
  const args: ArgMap = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith('-')) {
      continue;
    }

    const key = token.startsWith('--') ? token.slice(2) : token.slice(1);
    const value = rest[index + 1];

    if (value && !value.startsWith('-')) {
      args[key] = value;
      index += 1;
    } else {
      args[key] = 'true';
    }
  }

  return [command, args];
}

function requireOption(options: ArgMap, names: string[]): string {
  for (const name of names) {
    const value = options[name];
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required option: ${names.map((name) => `--${name}`).join(' or ')}`);
}

function printHelp(): void {
  console.log(`Factory Orchestrator Tool (TypeScript)

Usage:
  pnpm factory-orchestrator -- <command> [options]

Commands:
  process-placeholders   Inject placeholder prompts into template files
    --order-id <value>
    --placeholder-json <path>
    --workspace <path>

  validate-order         Validate an order JSON structure
    --order-file <path>

  list-templates         List available templates for a factory
    --factory-path <path>

  extract-placeholders   Extract placeholders from a template directory
    --template-path <path>
`);
}

async function main(): Promise<void> {
  const [command, options] = parseArgs(process.argv);

  try {
    switch (command) {
      case 'process-placeholders': {
        const orderId = requireOption(options, ['order-id', 'o']);
        const placeholderJson = requireOption(options, ['placeholder-json', 'j']);
        const workspace = requireOption(options, ['workspace', 'w']);

        const result = await processPlaceholders(orderId, placeholderJson, workspace);

        console.log(`✓ Processed placeholders for order ${result.orderId}`);
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      case 'validate-order': {
        const orderFile = requireOption(options, ['order-file', 'f']);
        const result = await validateOrder(orderFile);

        if (result.ok) {
          console.log('✓ Order is valid');
        } else {
          console.error('✗ Order validation failed:');
          result.errors?.forEach((error) => console.error(`  - ${error}`));
        }

        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) {
          process.exitCode = 1;
        }
        return;
      }

      case 'list-templates': {
        const factoryPath = requireOption(options, ['factory-path', 'p']);
        const templates = await listTemplates(factoryPath);

        console.log(`✓ Found ${templates.length} templates`);
        console.log(JSON.stringify({ ok: true, templates }, null, 2));
        return;
      }

      case 'extract-placeholders': {
        const templatePath = requireOption(options, ['template-path', 't']);
        const placeholders = await extractPlaceholders(templatePath);

        console.log('✓ Extracted placeholders');
        console.log(JSON.stringify({ ok: true, templateFiles: placeholders }, null, 2));
        return;
      }

      default:
        printHelp();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ ${message}`);
    process.exitCode = 1;
  }
}

void main();

