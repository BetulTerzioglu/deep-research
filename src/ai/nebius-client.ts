// Nebius API'sine doğrudan istek gönderen bir istemci
import { OutputManager } from '../output-manager';

const output = new OutputManager();

// Helper function for consistent logging
function log(...args: any[]) {
  output.log(...args);
}

export interface NebiusCompletionOptions {
  model?: string;
  temperature?: number;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

export interface NebiusCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function nebiusCompletion(options: NebiusCompletionOptions): Promise<NebiusCompletionResponse> {
  const apiKey = process.env.NEBIUS_API_KEY;
  const baseUrl = process.env.NEBIUS_ENDPOINT || 'https://api.studio.nebius.com/v1';
  const model = options.model || process.env.OPENAI_MODEL || 'meta-llama/Llama-3.3-70B-Instruct';
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: options.temperature ?? 0,
        messages: options.messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nebius API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    log('Nebius API error:', error);
    throw error;
  }
} 