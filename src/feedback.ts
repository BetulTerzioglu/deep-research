import { generateObject } from 'ai';
import { z } from 'zod';

import { o3MiniModel } from './ai/providers';
import { nebiusCompletion } from './ai/nebius-client';
import { systemPrompt } from './prompt';
import { OutputManager } from './output-manager';

const output = new OutputManager();

// Helper function for consistent logging
function log(...args: any[]) {
  output.log(...args);
}

export async function generateFeedback({
  query,
  numQuestions = 3,
}: {
  query: string;
  numQuestions?: number;
}) {
  try {
    // Nebius API'sini kullanarak feedback oluştur
    const response = await nebiusCompletion({
      messages: [
        {
          role: 'system',
          content: systemPrompt(),
        },
        {
          role: 'user',
          content: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear: <query>${query}</query>

Return your response in JSON format like this:
{
  "questions": ["question1", "question2", "question3"]
}`,
        },
      ],
    });

    // API yanıtını işle
    const content = response.choices[0]?.message?.content || '';
    
    try {
      // JSON yanıtını ayrıştır
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonContent = JSON.parse(jsonMatch[0]);
        return jsonContent.questions.slice(0, numQuestions);
      }
    } catch (parseError) {
      log('JSON parsing error:', parseError);
    }

    // Fallback: Eğer JSON ayrıştırma başarısız olursa, basit bir metin işleme yap
    const questions = content
      .split('\n')
      .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('1. '))
      .map(line => line.replace(/^-\s+|^\d+\.\s+/, '').trim())
      .slice(0, numQuestions);

    return questions.length > 0 ? questions : [`Could you provide more details about "${query}"?`];
  } catch (error) {
    log('Error generating feedback:', error);
    
    // Hata durumunda varsayılan bir soru döndür
    return [`Could you provide more details about "${query}"?`];
  }
}
