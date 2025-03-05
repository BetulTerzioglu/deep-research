import * as fs from 'fs/promises';
import * as readline from 'readline';
import FirecrawlApp from '@mendable/firecrawl-js';

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

// Initialize Firecrawl with optional API key and optional base url
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

// Helper function to get user input
function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

// Test Firecrawl API
async function testFirecrawlAPI(query: string) {
  try {
    log(`Searching with Firecrawl API for: ${query}`);
    const response = await firecrawl.search(query, {
      timeout: 15000,
      limit: 2,
      scrapeOptions: { formats: ['markdown'] },
    });
    log('Firecrawl API response:');
    log('Results:', response.data.map(r => r.url).join('\n'));
    return response;
  } catch (error) {
    log('Firecrawl API error:', error);
    return null;
  }
}

// run the agent
async function run() {
  try {
    // Get initial query from user
    const initialQuery = await askQuestion('What would you like to research? ');
    
    // Sorgu uzunluğunu kontrol et
    if (initialQuery.length > 100) {
      log('Uyarı: Uzun sorgular zaman aşımına neden olabilir. Sorgunuzu kısaltmanız önerilir.');
      const continueWithLongQuery = await askQuestion('Uzun sorgu ile devam etmek istiyor musunuz? (y/n): ');
      if (continueWithLongQuery.toLowerCase() !== 'y') {
        const shorterQuery = await askQuestion('Lütfen daha kısa bir sorgu girin: ');
        return await processQuery(shorterQuery);
      }
    }

    return await processQuery(initialQuery);
  } catch (error) {
    log('Error running research:', error);
    return 1;
  } finally {
    rl.close();
  }
}

async function processQuery(query: string) {
  try {
    // Ask if user wants to test Firecrawl API
    const testFirecrawl = await askQuestion('Do you want to test Firecrawl API first? (y/n): ');
    
    if (testFirecrawl.toLowerCase() === 'y') {
      await testFirecrawlAPI(query);
      const continueResearch = await askQuestion('Continue with full research? (y/n): ');
      if (continueResearch.toLowerCase() !== 'y') {
        return 0;
      }
    }

    // Ask for feedback to clarify research direction
    log('To better understand your research needs, please answer these follow-up questions:');
    const feedbackQuestions = await generateFeedback({ query });
    
    let additionalInfo = '';
    for (const question of feedbackQuestions) {
      const answer = await askQuestion(`${question}\nYour answer: `);
      additionalInfo += `\n\nQuestion: ${question}\nAnswer: ${answer}`;
    }
    
    // Combine original query with additional info
    const enhancedQuery = `${query}${additionalInfo}`;
    
    // Ask for research parameters
    log('Creating research plan...');
    
    // Default values
    let breadth = 3;
    let depth = 2;
    
    const customParams = await askQuestion('Do you want to customize research parameters? (y/n): ');
    if (customParams.toLowerCase() === 'y') {
      const breadthInput = await askQuestion('Enter breadth (number of queries per level, default 3): ');
      if (breadthInput.trim() !== '') {
        breadth = parseInt(breadthInput, 10) || 3;
      }
      
      const depthInput = await askQuestion('Enter depth (levels of research, default 2): ');
      if (depthInput.trim() !== '') {
        depth = parseInt(depthInput, 10) || 2;
      }
    }
    
    // Start research with progress reporting
    const startTime = Date.now();
    log(`Starting research with breadth=${breadth}, depth=${depth}`);
    
    const { learnings, visitedUrls } = await deepResearch({
      query: enhancedQuery,
      breadth,
      depth,
      onProgress: (progress) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const percent = Math.round((progress.completedQueries / progress.totalQueries) * 100) || 0;
        log(`Progress: ${percent}% (${progress.completedQueries}/${progress.totalQueries} queries) - ${elapsed}s elapsed`);
        if (progress.currentQuery) {
          log(`Current query: ${progress.currentQuery}`);
        }
      }
    });
    
    // Generate final report
    log('Generating final report...');
    const report = await writeFinalReport({
      prompt: enhancedQuery,
      learnings,
      visitedUrls,
    });
    
    // Write report to file
    const filename = 'report.md';
    await fs.writeFile(filename, report);
    log(`Report written to ${filename}`);
    
    return 0;
  } catch (error) {
    log(`Error running query: ${query}: `, error);
    
    // Hata durumunda kullanıcıya daha basit bir sorgu girme seçeneği sun
    const tryAgain = await askQuestion('Hata oluştu. Daha basit bir sorgu ile tekrar denemek ister misiniz? (y/n): ');
    if (tryAgain.toLowerCase() === 'y') {
      const simpleQuery = await askQuestion('Lütfen daha basit bir sorgu girin: ');
      return await processQuery(simpleQuery);
    }
    
    return 1;
  }
}

run().catch(console.error);
