import { NormalizedImage } from '../imagery/types.js';
import { TaskClassification } from '../schemas/responses.js';
import { AIProvider } from '../providers/AIProvider.js';

import { SessionState } from '../session/sessionManager.js';

export interface ToolInput {
  query: string;
  images: NormalizedImage[];
  [key: string]: any;
}

export interface ToolContext {
  provider: AIProvider;
  systemInstruction: string;
  session?: SessionState;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface Tool {
  name: string;
  description: string;
  version: string;
  supportedTasks: TaskClassification[];
  supportedModalities: string[];
  isImplemented: boolean; // false = UNAVAILABLE, true = AVAILABLE
  execute(input: ToolInput, context: ToolContext): Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getForTask(task: TaskClassification): Tool[] {
    return this.getAll().filter(t => t.supportedTasks.includes(task));
  }
}

export const globalRegistry = new ToolRegistry();
