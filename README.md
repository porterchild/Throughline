# Throughline for ResearchRabbit

A Chrome extension that helps you trace conceptual throughlines across academic papers in ResearchRabbit.

## Current Status: Basic Collection MVP

This version lets you:
- ✅ Add papers to your Throughline collection
- ✅ View saved papers in the extension popup
- ✅ Remove papers individually or clear all

**Coming soon:** LLM-powered analysis to find spiritual successors, latest work in the same vein, and conceptual connections.

## Installation

1. Download/clone these files into a folder called `researchrabbit-extension`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `researchrabbit-extension` folder
6. Navigate to ResearchRabbit and switch to **list view**

## Usage

1. Go to https://app.researchrabbit.ai/ and open a collection
2. Switch to **list view** (the button with three horizontal lines)
3. Click "➕ Add to Throughline" on any paper
4. Click the extension icon in your browser toolbar to view your saved papers
5. Papers show with title, abstract, and metadata
6. Click "🔍 Trace throughlines" to see all papers and begin analysis
7. Remove individual papers or "Clear All"

## Next Steps

Once this works, we'll:
1. Add LLM API integration (Claude/OpenAI)
2. Implement "Find spiritual successors" feature
3. Add "Author's latest in this vein" analysis
4. Create relationship mapping between papers

## Technical Notes

- Uses structural DOM queries instead of CSS class names for resilience
- Stores papers in Chrome's local storage
- Monitors DOM changes to detect newly loaded papers
- No external API calls yet (all data stays local)
