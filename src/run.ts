import * as fs from 'fs/promises';
import * as readline from 'readline';
import { tavily } from '@tavily/core';

import { deepResearch, writeFinalReport } from './deep-research';
import { generateFeedback } from './feedback';
import { OutputManager } from './output-manager';

const output = new OutputManager();

// Helper function for consistent logging
function log(...args: any[]) {
  output.log(...args);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Initialize Tavily with API key
const tavilyClient = tavily({ 
  apiKey: process.env.TAVILY_API_KEY ?? '' 
});

// Helper function to get user input
function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

// Test Tavily API
async function testTavilyAPI(query: string) {
  try {
    log(`Searching with Tavily API for: ${query}`);
    const response = await tavilyClient.search(query, {
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
    });
    log('Tavily API response:');
    log('Answer:', response.answer);
    log('Results:', response.results.map(r => r.url).join('\n'));
    return response;
  } catch (error) {
    log('Tavily API error:', error);
    return null;
  }
}

// run the agent
async function run() {
  // Get initial query
  const initialQuery = await askQuestion('What would you like to research? ');

  // Ask if user wants to test Tavily API
  const testTavily = await askQuestion('Do you want to test Tavily API first? (y/n): ');
  
  if (testTavily.toLowerCase() === 'y') {
    await testTavilyAPI(initialQuery);
    const continueResearch = await askQuestion('Continue with full research? (y/n): ');
    if (continueResearch.toLowerCase() !== 'y') {
      rl.close();
      return;
    }
  }

  // Get breath and depth parameters
  const breadth =
    parseInt(
      await askQuestion(
        'Enter research breadth (recommended 2-10, default 4): ',
      ),
      10,
    ) || 4;
  const depth =
    parseInt(
      await askQuestion('Enter research depth (recommended 1-5, default 2): '),
      10,
    ) || 2;

  log(`Creating research plan...`);

  // Generate follow-up questions
  const followUpQuestions = await generateFeedback({
    query: initialQuery,
  });

  log(
    '\nTo better understand your research needs, please answer these follow-up questions:',
  );

  // Collect answers to follow-up questions
  const answers: string[] = [];
  for (const question of followUpQuestions) {
    const answer = await askQuestion(`\n${question}\nYour answer: `);
    answers.push(answer);
  }

  // Combine all information for deep research
  const combinedQuery = `
Initial Query: ${initialQuery}
Follow-up Questions and Answers:
${followUpQuestions.map((q: string, i: number) => `Q: ${q}\nA: ${answers[i]}`).join('\n')}
`;

  log('\nResearching your topic...');

  log('\nStarting research with progress tracking...\n');
  
  const { learnings, visitedUrls } = await deepResearch({
    query: combinedQuery,
    breadth,
    depth,
    onProgress: (progress) => {
      output.updateProgress(progress);
    },
  });

  log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
  log(
    `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
  );
  log('Writing final report...');

  const report = await writeFinalReport({
    prompt: combinedQuery,
    learnings,
    visitedUrls,
  });

  // Save report to file
  await fs.writeFile('output.md', report, 'utf-8');

  console.log(`\n\nFinal Report:\n\n${report}`);
  console.log('\nReport has been saved to output.md');
  rl.close();
}

run().catch(console.error);
