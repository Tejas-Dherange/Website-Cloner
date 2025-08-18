import "dotenv/config";
import { OpenAI } from "openai";
import axios from "axios";
import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import * as cheerio from "cheerio";
import { URL } from "url";

// ... (keeping all existing helper functions: getWeatherDetailsByCity, writeFileContent, executeCommand, getGithubUserInfoByUsername, toAbsolute, downloadCSS, downloadJS, downloadGeneric, downloadImageSmart, validatePaths)

// Enhanced function to get URLs from a website page
async function getUrlsInWebsitePage(url) {
  try {
    console.log(`🔍 Scanning ${url} for subpages...`);
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const links = new Set();
    const baseUrlObj = new URL(url);
    const baseDomain = baseUrlObj.origin;

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href) {
        // Handle relative URLs starting with /
        if (href.startsWith("/") && href !== "/") {
          links.add(href);
        }
        // Handle absolute URLs from same domain
        else if (href.startsWith(baseDomain) && href !== url) {
          const relativePath = href.replace(baseDomain, "");
          if (relativePath && relativePath !== "/") {
            links.add(relativePath);
          }
        }
        // Handle relative URLs without leading slash
        else if (!href.startsWith("http") && !href.startsWith("mailto:") && !href.startsWith("tel:") && href !== "#") {
          if (!href.includes(".") || href.endsWith(".html")) {
            links.add("/" + href.replace(/^\.\//, ""));
          }
        }
      }
    });

    const paths = [...links].filter(p => {
      // Filter out common non-page URLs
      return !p.includes("#") && 
             !p.includes("?") && 
             !p.endsWith(".pdf") && 
             !p.endsWith(".zip") && 
             !p.endsWith(".jpg") && 
             !p.endsWith(".png") && 
             !p.endsWith(".gif") && 
             !p.includes("admin") &&
             !p.includes("login");
    });

    console.log(`📄 Found ${paths.length} potential subpages:`, paths);
    return paths;

  } catch (err) {
    console.error("Error scraping URLs:", err.message);
    return [];
  }
}

// Enhanced clone site function with subpage support
async function cloneSiteWithSubpages(input = "") {
  try {
    let siteUrl, outputDir;
    
    if (input.includes('|||')) {
      const parts = input.split('|||');
      siteUrl = parts[0].trim();
      outputDir = parts[1].trim();
    } else if (input.includes(',')) {
      const parts = input.split(',');
      siteUrl = parts[0].trim();
      outputDir = parts[1].trim();
    } else {
      return "Error: Input should be in format 'siteUrl|||outputDir' or 'siteUrl, outputDir'";
    }

    console.log(`🌐 Cloning ${siteUrl} with subpages -> ${outputDir}`);
    await fs.ensureDir(outputDir);

    const baseUrlObj = new URL(siteUrl);
    const baseDomain = baseUrlObj.origin;
    
    // Step 1: Clone the main page
    console.log("📄 Step 1: Cloning main page...");
    const mainPageResult = await cloneSite(input);
    console.log(mainPageResult);

    // Step 2: Get all subpage URLs
    console.log("📄 Step 2: Finding subpages...");
    const subpageUrls = await getUrlsInWebsitePage(siteUrl);
    
    if (subpageUrls.length === 0) {
      return mainPageResult + "\n🔍 No subpages found to clone.";
    }

    // Step 3: Clone each subpage
    console.log(`📄 Step 3: Cloning ${subpageUrls.length} subpages...`);
    const subpagesDir = path.join(outputDir, 'pages');
    await fs.ensureDir(subpagesDir);
    
    let clonedPages = [];
    
    for (let i = 0; i < Math.min(subpageUrls.length, 10); i++) { // Limit to 10 subpages
      const subpageUrl = subpageUrls[i];
      const fullSubpageUrl = baseDomain + subpageUrl;
      
      try {
        console.log(`📝 Cloning subpage ${i + 1}/${Math.min(subpageUrls.length, 10)}: ${subpageUrl}`);
        
        // Create filename from URL path
        let filename = subpageUrl.replace(/^\//, '').replace(/\/$/, '') || 'page';
        filename = filename.replace(/[^a-zA-Z0-9-_]/g, '-');
        if (!filename.endsWith('.html')) {
          filename += '.html';
        }
        
        const subpageOutputPath = path.join(subpagesDir, filename);
        
        // Clone the subpage
        const { data: html } = await axios.get(fullSubpageUrl);
        const $ = cheerio.load(html);

        // Update asset paths to point to parent directory
        $("link[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (href && href.startsWith('./')) {
            $(el).attr("href", '../' + href);
          }
        });
        
        $("script[src]").each((_, el) => {
          const src = $(el).attr("src");
          if (src && src.startsWith('./')) {
            $(el).attr("src", '../' + src);
          }
        });
        
        $("img[src]").each((_, el) => {
          const src = $(el).attr("src");
          if (src && src.startsWith('./')) {
            $(el).attr("src", '../' + src);
          }
        });

        // Save the subpage
        await fs.writeFile(subpageOutputPath, $.html());
        clonedPages.push({ url: subpageUrl, filename: filename, fullPath: `./pages/${filename}` });
        
      } catch (error) {
        console.error(`❌ Failed to clone subpage ${subpageUrl}:`, error.message);
      }
    }

    // Step 4: Update main page with links to cloned subpages
    console.log("📄 Step 4: Updating main page navigation...");
    const mainIndexPath = path.join(outputDir, 'index.html');
    const mainHtml = await fs.readFile(mainIndexPath, 'utf8');
    const $main = cheerio.load(mainHtml);
    
    // Update existing links to point to cloned pages
    $main("a").each((_, el) => {
      const href = $main(el).attr("href");
      if (href) {
        const clonedPage = clonedPages.find(p => p.url === href || p.url === '/' + href.replace(/^\//, ''));
        if (clonedPage) {
          $main(el).attr("href", clonedPage.fullPath);
          console.log(`🔗 Updated link: ${href} -> ${clonedPage.fullPath}`);
        }
      }
    });

    // Save updated main page
    await fs.writeFile(mainIndexPath, $main.html());

    // Step 5: Final validation
    console.log("📄 Step 5: Validating all paths...");
    const validation = await validatePaths(outputDir);
    
    let resultMessage = `✅ Successfully cloned ${siteUrl} with ${clonedPages.length} subpages to ${outputDir}\n`;
    resultMessage += `📁 Main page: index.html\n`;
    resultMessage += `📁 Subpages: pages/ (${clonedPages.length} files)\n`;
    resultMessage += `📁 Assets: css/, js/, images/\n`;
    resultMessage += `🔗 Updated ${clonedPages.length} navigation links in main page\n`;
    resultMessage += `🔍 Path validation: ${validation.validPaths}/${validation.totalPaths} valid paths\n`;
    
    if (clonedPages.length > 0) {
      resultMessage += `📋 Cloned subpages:\n${clonedPages.map(p => `  - ${p.url} -> ${p.fullPath}`).join('\n')}`;
    }
    
    if (!validation.isValid) {
      resultMessage += `\n⚠️ Issues found:\n${validation.issues.join('\n')}`;
    }
    
    return resultMessage;
    
  } catch (err) {
    return `❌ Error cloning site with subpages: ${err.message}`;
  }
}

// Original cloneSite function (keeping for backward compatibility)
async function cloneSite(input = "") {
  try {
    let siteUrl, outputDir;
    
    if (input.includes('|||')) {
      const parts = input.split('|||');
      siteUrl = parts[0].trim();
      outputDir = parts[1].trim();
    } else if (input.includes(',')) {
      const parts = input.split(',');
      siteUrl = parts[0].trim();
      outputDir = parts[1].trim();
    } else {
      return "Error: Input should be in format 'siteUrl|||outputDir' or 'siteUrl, outputDir'";
    }
    
    console.log(`🌐 Cloning ${siteUrl} -> ${outputDir}`);
    await fs.ensureDir(outputDir);

    // 1. Get HTML
    const { data: html } = await axios.get(siteUrl);
    const $ = cheerio.load(html);

    // 2. Collect and categorize assets
    const cssAssets = [];
    const jsAssets = [];
    const imageAssets = [];
    
    // Find CSS files
    $("link[href]").each((_, el) => {
      const href = $(el).attr("href");
      const rel = $(el).attr("rel");
      if (href && (rel === 'stylesheet' || href.includes('.css'))) {
        cssAssets.push({ url: toAbsolute(siteUrl, href), originalHref: href, element: el });
      }
    });
    
    // Find JS files
    $("script[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src && !src.startsWith('data:')) {
        jsAssets.push({ url: toAbsolute(siteUrl, src), originalSrc: src, element: el });
      }
    });
    
    // Find images
    $("img[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src && !src.startsWith('data:')) {
        imageAssets.push({ url: toAbsolute(siteUrl, src), originalSrc: src, element: el, type: 'img' });
      }
    });
    
    // Find preload images
    $("link[rel='preload'][as='image']").each((_, el) => {
      const href = $(el).attr("href");
      if (href && !href.startsWith('data:')) {
        imageAssets.push({ url: toAbsolute(siteUrl, href), originalHref: href, element: el, type: 'preload' });
      }
    });
    
    // Find background images in style attributes
    $('[style*="background"]').each((_, el) => {
      const style = $(el).attr('style');
      if (style) {
        const urlMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('data:')) {
          imageAssets.push({ 
            url: toAbsolute(siteUrl, urlMatch[1]), 
            originalSrc: urlMatch[1], 
            element: el,
            type: 'background' 
          });
        }
      }
    });

    console.log(`📊 Found: ${cssAssets.length} CSS, ${jsAssets.length} JS, ${imageAssets.length} images`);

    // 3. Download CSS files
    for (const asset of cssAssets) {
      const localPath = await downloadCSS(asset.url, outputDir);
      if (localPath) {
        $(asset.element).attr("href", localPath);
      }
    }

    // 4. Download JS files
    for (const asset of jsAssets) {
      const localPath = await downloadJS(asset.url, outputDir);
      if (localPath) {
        $(asset.element).attr("src", localPath);
      }
    }

    // 5. Download images
    const imagePromises = imageAssets.map(async (asset) => {
      const localPath = await downloadImageSmart(asset.originalSrc || asset.originalHref, siteUrl, outputDir);
      if (localPath) {
        if (asset.type === 'background') {
          const currentStyle = $(asset.element).attr('style');
          const newStyle = currentStyle.replace(
            /url\(['"]?[^'")\s]+['"]?\)/,
            `url('${localPath}')`
          );
          $(asset.element).attr('style', newStyle);
        } else if (asset.type === 'preload') {
          $(asset.element).attr("href", localPath);
        } else {
          $(asset.element).attr("src", localPath);
          $(asset.element).removeAttr("srcset");
        }
      }
    });
    
    await Promise.all(imagePromises);

    // 6. Save modified HTML
    const outHtml = path.join(outputDir, "index.html");
    await fs.writeFile(outHtml, $.html());
    
    // 7. Validate paths
    const validation = await validatePaths(outputDir);
    
    let resultMessage = `✅ Successfully cloned ${siteUrl} to ${outputDir}\n`;
    resultMessage += `📁 Structure: css/ (${cssAssets.length} files), js/ (${jsAssets.length} files), images/ (${imageAssets.length} files)\n`;
    resultMessage += `🔍 Path validation: ${validation.validPaths}/${validation.totalPaths} valid paths`;
    
    if (!validation.isValid) {
      resultMessage += `\n⚠️ Issues found:\n${validation.issues.join('\n')}`;
    }
    
    return resultMessage;
  } catch (err) {
    return `❌ Error cloning site: ${err.message}`;
  }
}

// Updated tool map
const TOOL_MAP = {
//   getWeatherDetailsByCity: getWeatherDetailsByCity,
//   getGithubUserInfoByUsername: getGithubUserInfoByUsername,
//   executeCommand: executeCommand,
//   writeFileContent: writeFileContent,
  cloneSite: cloneSite,
  cloneSiteWithSubpages: cloneSiteWithSubpages, // New enhanced function
//   validateAndFixPaths: validateAndFixPaths,
  getUrlsInWebsitePage: getUrlsInWebsitePage
};

// Updated system prompt example
const UPDATED_SYSTEM_PROMPT_EXAMPLE = `
Example for cloning a site with subpages:
user: Hey, clone this url https://tejas-portfolio.codeloom.software with subpages in folder name Portfolio
step-1: ASSISTANT: { "step": "START", "content": "The user wants to clone a website including its subpages into a specific folder." }
step-2: ASSISTANT: { "step": "THINK", "content": "I need to use the cloneSiteWithSubpages function to clone both the main page and its subpages with proper linking." }
step-3: ASSISTANT: { "step": "TOOL", "input": "https://tejas-portfolio.codeloom.software|||Portfolio", "tool_name": "cloneSiteWithSubpages" }
step-4: DEVELOPER: { "step": "OBSERVE", "content": "✅ Successfully cloned https://tejas-portfolio.codeloom.software with 5 subpages to Portfolio\n📁 Main page: index.html\n📁 Subpages: pages/ (5 files)\n📁 Assets: css/, js/, images/\n🔗 Updated 5 navigation links in main page\n🔍 Path validation: 45/45 valid paths" }
step-5: ASSISTANT: { "step": "THINK", "content": "Perfect! The website has been cloned with subpages and all navigation links have been properly updated." }
step-6: ASSISTANT: { "step": "OUTPUT", "content": "The website has been successfully cloned with all subpages! The main page is saved as index.html, subpages are organized in the pages/ folder, and all navigation links have been updated to work locally. The folder structure includes css/, js/, images/, and pages/ directories with all assets properly linked." }
`;

const client = new OpenAI();

// Example usage
async function main() {
  const SYSTEM_PROMPT = `
    You are an AI assistant who works on START, THINK and OUTPUT format.
    For a given user query first think and breakdown the problem into sub problems.
    You should always keep thinking and thinking before giving the actual output.
    
    Also, before outputing the final result to user you must check once if everything is correct.
    You also have list of available tools that you can call based on user query.
    
    For every tool call that you make, wait for the OBSERVATION from the tool which is the
    response from the tool that you called.

    Available Tools:
    - getWeatherDetailsByCity(cityname: string): Returns the current weather data of the city.
    - getGithubUserInfoByUsername(username: string): Returns the public info about the github user using github api
    - executeCommand(command: string): Takes a windows powershell command as arg and executes the command on user's machine and returns the output
    - writeFileContent(input: string): Creates a file with specified content. Input format: "filepath|||content" where ||| separates the file path from the content
    - cloneSite(input: string): Clones a website's HTML, CSS, and JS assets to a local directory. Input format: "siteUrl|||outputDir" or "siteUrl, outputDir". Creates separate folders: css/, js/, images/
    - cloneSiteWithSubpages(input: string): Enhanced version that clones main page AND subpages (one level deep) with proper navigation linking. Same input format as cloneSite.
    - validateAndFixPaths(input: string): Validates all relative paths in a cloned website directory and reports any issues
    - getUrlsInWebsitePage(input: string): Scrapes a webpage and returns array of all the paths of sub-pages found on the page

    IMPORTANT for file creation:
    - For creating HTML/CSS/JS files, ALWAYS use the writeFileContent tool instead of executeCommand with echo
    - The writeFileContent tool properly handles newlines, quotes, and special characters
    - When using writeFileContent, provide input in format: "path/to/file.html|||<html><body>content</body></html>"
    - For creating directories, use executeCommand with "mkdir foldername"
    
    Rules:
    - Strictly follow the output JSON format
    - Always follow the output in sequence that is START, THINK, OBSERVE and OUTPUT.
    - Always perform only one step at a time and wait for other step.
    - Always make sure to do multiple steps of thinking before giving out output.
    - For every tool call always wait for the OBSERVE which contains the output from tool
    - Use cloneSiteWithSubpages when user wants to clone a site with its subpages
    - Use cloneSite for simple single-page cloning
    - Always validate paths after cloning

    Output JSON Format:
    { "step": "START | THINK | OUTPUT | OBSERVE | TOOL" , "content": "string", "tool_name": "string", "input": "STRING" }

    ${UPDATED_SYSTEM_PROMPT_EXAMPLE}
  `;

  // Test the enhanced functionality
  console.log("🚀 Testing enhanced website cloner...");
  
  // Example: Clone a site with subpages
  const result = await cloneSiteWithSubpages("https://www.piyushgarg.dev|||piyush2-clone");
  console.log(result);
}

// Uncomment to test
main();