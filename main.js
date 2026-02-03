#!/usr/bin/env node
/**
 * Throughline - Standalone entry point
 * 
 * Run research lineage analysis from the command line or as a module.
 * This is the simple JS main entry point that works without the browser extension.
 * 
 * Usage:
 *   node main.js <papers-json-file>
 *   node main.js  # uses example papers
 *
 * Optional clustering criteria:
 *   THROUGHLINE_CLUSTERING_CRITERIA="Group by lab/author lineage" node main.js papers.json
 * 
 * Or import as a module:
 *   const { analyzePapers } = require('./main.js');
 *   const results = await analyzePapers(papers, apiKey);
 */

const { ThroughlineAnalyzer } = require('./src/throughline-analyzer.js');
const fs = require('fs');
const path = require('path');

// Load .env file if it exists
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

// Load .env file on startup
loadEnvFile();

// Example seed papers for testing
const EXAMPLE_PAPERS = [
  {
    title: "Attention Is All You Need",
    abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks in an encoder-decoder configuration. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU. On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature. We show that the Transformer generalizes well to other tasks by applying it successfully to English constituency parsing both with large and limited training data.",
    year: 2017,
    authors: [{ name: "Vaswani, A." }, { name: "Shazeer, N." }],
    nickname: "Vaswani et al., 2017"
  },
  {
    title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    abstract: "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers. As a result, the pre-trained BERT model can be fine-tuned with just one additional output layer to create state-of-the-art models for a wide range of tasks, such as question answering and language inference, without substantial task-specific architecture modifications. BERT is conceptually simple and empirically powerful. It obtains new state-of-the-art results on eleven natural language processing tasks, including pushing the GLUE score to 80.5% (7.7% point absolute improvement), MultiNLI accuracy to 86.7% (4.6% absolute improvement) and SQuAD v1.1 question answering Test F1 to 93.2 (1.5 point absolute improvement), outperforming human performance by 2.0%.",
    year: 2019,
    authors: [{ name: "Devlin, J." }, { name: "Chang, M.W." }],
    nickname: "Devlin et al., 2019"
  }
];

/**
 * Analyze papers and trace research lineages
 * @param {Array} papers - Array of seed paper objects
 * @param {string} apiKey - OpenRouter API key
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzePapers(papers, apiKey, options = {}) {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable or pass as parameter.');
  }

  const config = {
    openRouterApiKey: apiKey,
    maxThreads: options.maxThreads || 5,
    maxPapersPerThread: options.maxPapersPerThread || 10,
    clusteringCriteria: options.clusteringCriteria || process.env.THROUGHLINE_CLUSTERING_CRITERIA || null,
    logger: {
      log: (...args) => console.log('[Throughline]', ...args),
      error: (...args) => console.error('[Throughline]', ...args),
      warn: (...args) => console.warn('[Throughline]', ...args)
    }
  };

  const analyzer = new ThroughlineAnalyzer(config);

  // Progress callback
  const onProgress = (message, detail, percent, threads) => {
    if (percent !== null) {
      process.stdout.write(`\r${message} - ${percent.toFixed(1)}%`);
    } else {
      console.log(`\n${message}`);
      if (detail) console.log(`  ${detail}`);
    }
    
    if (threads && threads.length > 0) {
      console.log(`\n  Active threads: ${threads.length}`);
    }
  };

  console.log('Starting analysis of', papers.length, 'seed papers...');
  
  const startTime = Date.now();
  
  try {
    const threads = await analyzer.traceResearchLineages(papers, onProgress);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\nAnalysis complete in ${duration}s!`);
    console.log(`Found ${threads.length} research threads`);
    
    return {
      success: true,
      threads,
      debugTree: analyzer.getDebugTree(),
      duration: parseFloat(duration),
      seedPapers: papers.length
    };
  } catch (error) {
    console.error('\n\nAnalysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      debugTree: analyzer.getDebugTree(),
      partialResults: analyzer.threads
    };
  }
}

/**
 * Display results in a readable format
 */
function displayResults(results) {
  if (!results.success) {
    console.error('\nAnalysis failed:', results.error);
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log('RESEARCH LINEAGES FOUND');
  console.log('='.repeat(70));

  results.threads.forEach((thread, i) => {
    console.log(`\n${i + 1}. ${thread.theme}`);
    console.log(`   Spawned from: "${thread.spawnPaper.title}" (${thread.spawnYear})`);
    console.log(`   Papers in thread: ${thread.papers.length}`);
    
    thread.papers.forEach((paper, j) => {
      const indent = j === 0 ? '     → ' : '       ';
      console.log(`${indent}[${paper.year}] ${paper.title.substring(0, 60)}${paper.title.length > 60 ? '...' : ''}`);
      if (paper.selectionReason && j > 0) {
        console.log(`         └─ ${paper.selectionReason}`);
      }
    });

    if (thread.subThreads && thread.subThreads.length > 0) {
      console.log(`   Sub-threads: ${thread.subThreads.length}`);
      thread.subThreads.forEach((sub, k) => {
        console.log(`      ${k + 1}. ${sub.theme} (${sub.papers.length} papers)`);
      });
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Total: ${results.threads.length} threads from ${results.seedPapers} seed papers`);
  console.log(`Duration: ${results.duration}s`);
  console.log('='.repeat(70));
}

/**
 * Main function - handles CLI usage
 */
async function main() {
  // Get API key from environment (which may have been set from .env file)
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('Error: OPENROUTER_API_KEY not found in .env file or environment');
    console.error('\nOptions:');
    console.error('  1. Create a .env file with: OPENROUTER_API_KEY=your-key');
    console.error('  2. Set environment variable: OPENROUTER_API_KEY=your-key node main.js');
    console.error('  3. Edit the .env file in this directory');
    process.exit(1);
  }
  
  // Show which source the key came from (without revealing the key)
  const keySource = fs.existsSync(path.join(__dirname, '.env')) ? '.env file' : 'environment variable';
  console.log(`Using API key from ${keySource}`);

  // Load papers from file if provided, otherwise use examples
  let papers;
  const inputFile = process.argv[2];
  
  if (inputFile) {
    try {
      const data = fs.readFileSync(inputFile, 'utf8');
      papers = JSON.parse(data);
      console.log(`Loaded ${papers.length} papers from ${inputFile}`);
    } catch (error) {
      console.error(`Error loading ${inputFile}:`, error.message);
      process.exit(1);
    }
  } else {
    papers = EXAMPLE_PAPERS;
    console.log('No input file provided, using example papers');
    console.log('Run with: node main.js <papers.json>');
  }

  // Run analysis
  const results = await analyzePapers(papers, apiKey);
  
  // Display results
  displayResults(results);

  // Optionally save results
  if (results.success) {
    const outputFile = 'throughline-results.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${outputFile}`);
    
    // Also save debug tree
    const debugFile = 'throughline-debug-tree.txt';
    const debugText = formatDebugTree(results.debugTree);
    fs.writeFileSync(debugFile, debugText);
    console.log(`Debug tree saved to ${debugFile}`);
  }
}

/**
 * Format debug tree for text output
 */
function formatDebugTree(tree) {
  let text = '=== THROUGHLINE ANALYSIS DEBUG TREE ===\n\n';
  
  tree.forEach((node, i) => {
    const stackDepth = node.data?.stackDepth || 1;
    const baseIndent = '  '.repeat(stackDepth - 1);
    
    text += `\n${baseIndent}[${i + 1}] ${node.type.toUpperCase()}: ${node.message}\n`;
    
    if (node.data) {
      if (node.data.explanation) {
        text += `${baseIndent}    ${node.data.explanation}\n`;
      }
      if (node.data.found) {
        text += `${baseIndent}    Found: ${node.data.found}\n`;
      }
      if (node.data.decision) {
        text += `${baseIndent}    Decision: ${node.data.decision}\n`;
      }
      if (node.data.reason) {
        text += `${baseIndent}    Reason: ${node.data.reason}\n`;
      }
    }
  });
  
  return text;
}

// Run main if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for module usage
module.exports = { analyzePapers, ThroughlineAnalyzer };
