import * as pdfjsLib from "pdfjs-dist";

// Set worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Enhanced PDF text extraction with better structure and formatting
 * @param {File|string} file - PDF file or URL
 * @returns {Promise<Object>} - Structured text data with metadata
 */
export const extractPdfText = async (file) => {
  try {
    let pdfUrl;
    
    // Handle both File objects and URLs
    if (file instanceof File) {
      pdfUrl = URL.createObjectURL(file);
      console.log('PDF Text Extractor: Using File object, created blob URL:', pdfUrl);
    } else {
      pdfUrl = file;
      console.log('PDF Text Extractor: Using URL:', pdfUrl);
    }

    console.log('PDF Text Extractor: Attempting to load PDF document...');
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    console.log('PDF Text Extractor: PDF loaded successfully, pages:', pdf.numPages);
    
    const extractedData = {
      fullText: '',
      structuredText: [],
      metadata: {
        numPages: pdf.numPages,
        title: pdf.metadata?.Title || 'Untitled',
        author: pdf.metadata?.Author || 'Unknown',
        subject: pdf.metadata?.Subject || '',
        creationDate: pdf.metadata?.CreationDate || '',
        modificationDate: pdf.metadata?.ModDate || '',
      },
      pageTexts: [],
      tables: [],
      sections: []
    };

    // Extract text from each page with better structure
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Get page dimensions
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Process text items with positioning information
      const pageData = processPageText(textContent.items, pageNum, viewport);
      
      extractedData.pageTexts.push(pageData);
      extractedData.fullText += pageData.text + '\n\n';
      
      // Extract potential tables from the page
      const pageTables = extractTablesFromPage(textContent.items, pageNum, viewport);
      extractedData.tables = [...extractedData.tables, ...pageTables];
    }

    // Post-process the extracted text for better AI context
    extractedData.structuredText = structureTextForAI(extractedData);
    
    // Clean up blob URL if we created one
    if (file instanceof File) {
      URL.revokeObjectURL(pdfUrl);
      console.log('PDF Text Extractor: Cleaned up blob URL');
    }

    return extractedData;
    
  } catch (error) {
    console.error('PDF text extraction error:', error);
    
    // Provide more specific error messages
    if (error.name === 'UnknownErrorException' && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to fetch PDF: The PDF URL may not be accessible due to CORS restrictions or network issues. Try using a File object instead.');
    } else if (error.message.includes('Invalid PDF')) {
      throw new Error('Invalid PDF: The file may be corrupted or not a valid PDF document.');
    } else if (error.message.includes('Password required')) {
      throw new Error('Password required: This PDF is password-protected and cannot be processed.');
    } else {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
};

/**
 * Process text items from a single page with positioning and formatting
 */
const processPageText = (textItems, pageNum, viewport) => {
  // Sort items by Y coordinate (top to bottom)
  const sortedItems = textItems.sort((a, b) => b.transform[5] - a.transform[5]);
  
  // Group items by Y coordinate to identify lines
  const lines = groupItemsByYCoordinate(sortedItems);
  
  // Process each line
  const processedLines = Object.keys(lines).map(y => {
    const lineItems = lines[y].items.sort((a, b) => a.transform[4] - b.transform[4]);
    return {
      text: lineItems.map(item => item.str).join(' '),
      items: lineItems,
      y: parseFloat(y),
      page: pageNum
    };
  }).sort((a, b) => b.y - a.y); // Sort by Y coordinate (top to bottom)

  return {
    pageNum,
    text: processedLines.map(line => line.text).join('\n'),
    lines: processedLines,
    dimensions: {
      width: viewport.width,
      height: viewport.height
    }
  };
};

/**
 * Group text items by Y coordinate to identify lines
 */
const groupItemsByYCoordinate = (items) => {
  const tolerance = 5; // pixels tolerance for grouping items on the same line
  const lines = {};
  
  items.forEach(item => {
    const y = Math.round(item.transform[5] / tolerance) * tolerance;
    if (!lines[y]) {
      lines[y] = { items: [] };
    }
    lines[y].items.push({
      str: item.str,
      transform: item.transform,
      width: item.width,
      height: item.height,
      fontName: item.fontName
    });
  });
  
  return lines;
};

/**
 * Extract potential tables from page text items
 */
const extractTablesFromPage = (textItems, pageNum, viewport) => {
  const tables = [];
  
  // Group items by Y coordinate
  const lines = groupItemsByYCoordinate(textItems);
  const sortedLines = Object.keys(lines).map(y => ({
    y: parseFloat(y),
    items: lines[y].items.sort((a, b) => a.transform[4] - b.transform[4])
  })).sort((a, b) => b.y - a.y);

  // Look for table patterns (multiple columns, consistent spacing)
  let currentTable = null;
  
  for (let i = 0; i < sortedLines.length; i++) {
    const line = sortedLines[i];
    
    // Check if this line has multiple items (potential table row)
    if (line.items.length > 2) {
      // Calculate spacing between items
      const spacings = [];
      for (let j = 1; j < line.items.length; j++) {
        const spacing = line.items[j].transform[4] - line.items[j-1].transform[4];
        spacings.push(spacing);
      }
      
      // Check if spacing is consistent (table-like structure)
      const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
      const isConsistent = spacings.every(spacing => 
        Math.abs(spacing - avgSpacing) < avgSpacing * 0.3
      );
      
      // Also check for resume-specific patterns (dates, skills, etc.)
      const hasResumePatterns = line.items.some(item => 
        /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}$/.test(item.str) || // Dates
        /^[A-Z][a-z]+\s*:\s*/.test(item.str) || // Section headers
        /^(Skills?|Experience|Education|Projects?|Languages?|Certifications?)$/i.test(item.str) // Common resume sections
      );
      
      if ((isConsistent && avgSpacing > 50) || hasResumePatterns) { // Enhanced detection
        if (!currentTable) {
          currentTable = {
            page: pageNum,
            startY: line.y,
            rows: [],
            type: hasResumePatterns ? 'resume_section' : 'table'
          };
        }
        currentTable.rows.push({
          y: line.y,
          items: line.items.map(item => ({
            text: item.str,
            x: item.transform[4],
            width: item.width
          }))
        });
      } else if (currentTable) {
        // End of table
        currentTable.endY = sortedLines[i-1]?.y || line.y;
        tables.push(currentTable);
        currentTable = null;
      }
    } else if (currentTable) {
      // End of table
      currentTable.endY = sortedLines[i-1]?.y || line.y;
      tables.push(currentTable);
      currentTable = null;
    }
  }
  
  // Add final table if exists
  if (currentTable) {
    currentTable.endY = sortedLines[sortedLines.length - 1]?.y || currentTable.startY;
    tables.push(currentTable);
  }
  
  return tables;
};

/**
 * Structure extracted text for better AI context
 */
const structureTextForAI = (extractedData) => {
  const structured = [];
  
  // Add metadata section
  if (extractedData.metadata.title || extractedData.metadata.author) {
    structured.push({
      type: 'metadata',
      content: `Document: ${extractedData.metadata.title || 'Untitled'}
Author: ${extractedData.metadata.author || 'Unknown'}
Pages: ${extractedData.metadata.numPages}`
    });
  }
  
  // Add main content sections
  extractedData.pageTexts.forEach((page, index) => {
    structured.push({
      type: 'page',
      pageNum: page.pageNum,
      content: page.text,
      hasTables: extractedData.tables.some(table => table.page === page.pageNum)
    });
  });
  
  // Add table data if found
  if (extractedData.tables.length > 0) {
    extractedData.tables.forEach((table, index) => {
      const tableText = table.rows.map(row => 
        row.items.map(item => item.text).join(' | ')
      ).join('\n');
      
      structured.push({
        type: 'table',
        page: table.page,
        content: `Table on page ${table.page}:\n${tableText}`
      });
    });
  }
  
  return structured;
};

/**
 * Get formatted text for AI context
 */
export const getFormattedTextForAI = (extractedData) => {
  let formattedText = '';
  
  // Add document metadata
  if (extractedData.metadata.title) {
    formattedText += `DOCUMENT: ${extractedData.metadata.title}\n`;
  }
  if (extractedData.metadata.author) {
    formattedText += `AUTHOR: ${extractedData.metadata.author}\n`;
  }
  formattedText += `PAGES: ${extractedData.metadata.numPages}\n\n`;
  
  // Add main content
  extractedData.pageTexts.forEach((page, index) => {
    formattedText += `--- PAGE ${page.pageNum} ---\n`;
    formattedText += page.text + '\n\n';
  });
  
  // Add table information
  if (extractedData.tables.length > 0) {
    formattedText += '--- TABLES FOUND ---\n';
    extractedData.tables.forEach((table, index) => {
      formattedText += `Table on page ${table.page}:\n`;
      table.rows.forEach(row => {
        formattedText += row.items.map(item => item.text).join(' | ') + '\n';
      });
      formattedText += '\n';
    });
  }
  
  return formattedText.trim();
};

/**
 * Extract specific sections based on keywords
 */
export const extractSectionsByKeywords = (extractedData, keywords) => {
  const sections = {};
  
  keywords.forEach(keyword => {
    sections[keyword] = [];
    
    extractedData.pageTexts.forEach(page => {
      const lines = page.text.split('\n');
      lines.forEach((line, lineIndex) => {
        if (line.toLowerCase().includes(keyword.toLowerCase())) {
          // Get context around the keyword (few lines before and after)
          const start = Math.max(0, lineIndex - 2);
          const end = Math.min(lines.length, lineIndex + 3);
          const context = lines.slice(start, end).join('\n');
          
          sections[keyword] = [];
          
          // Extract resume-specific sections
          const resumeSections = extractResumeSections(extractedData);
          Object.assign(sections, resumeSections);
        }
      });
    });
  });
  
  return sections;
};

/**
 * Extract common resume sections automatically
 */
export const extractResumeSections = (extractedData) => {
  const sections = {
    contact: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: []
  };
  
  const sectionKeywords = {
    contact: ['email', 'phone', 'address', 'linkedin', 'github', 'portfolio'],
    summary: ['summary', 'objective', 'profile', 'about'],
    experience: ['experience', 'work history', 'employment', 'career'],
    education: ['education', 'degree', 'university', 'college', 'school'],
    skills: ['skills', 'technologies', 'tools', 'programming', 'languages'],
    projects: ['projects', 'portfolio', 'achievements', 'accomplishments'],
    certifications: ['certifications', 'certificates', 'awards', 'honors'],
    languages: ['languages', 'fluent', 'proficient', 'native']
  };
  
  extractedData.pageTexts.forEach(page => {
    const lines = page.text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      const lowerLine = line.toLowerCase();
      
      // Check each section type
      Object.entries(sectionKeywords).forEach(([sectionType, keywords]) => {
        if (keywords.some(keyword => lowerLine.includes(keyword))) {
          // Get context around the section header
          const start = Math.max(0, lineIndex);
          const end = Math.min(lines.length, lineIndex + 10); // Get more context for sections
          const context = lines.slice(start, end).join('\n');
          
          sections[sectionType].push({
            page: page.pageNum,
            line: lineIndex + 1,
            header: line.trim(),
            context: context.trim()
          });
        }
      });
    });
  });
  
  return sections;
};

/**
 * Get text statistics for analysis
 */
export const getTextStatistics = (extractedData) => {
  const fullText = extractedData.fullText;
  const words = fullText.split(/\s+/).filter(word => word.length > 0);
  const sentences = fullText.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
  
  return {
    totalCharacters: fullText.length,
    totalWords: words.length,
    totalSentences: sentences.length,
    averageWordsPerSentence: words.length / sentences.length,
    totalPages: extractedData.metadata.numPages,
    hasTables: extractedData.tables.length > 0,
    tableCount: extractedData.tables.length
  };
};
