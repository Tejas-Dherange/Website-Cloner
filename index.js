import "dotenv/config";
import { OpenAI } from "openai";
import axios from "axios";
import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import * as cheerio from "cheerio";
import { URL } from "url";

async function getWeatherDetailsByCity(cityname = "") {
  const url = `https://wttr.in/${cityname.toLowerCase()}?format=%C+%t`;
  const { data } = await axios.get(url, { responseType: "text" });
  return `The current weather of ${cityname} is ${data}`;
}


async function writeFileContent(input = "") {
  return new Promise((res, rej) => {
    try {
      // Parse the input if it's a JSON string with filepath and content
      let filepath, content;
      
      if (input.includes('|||')) {
        // Use triple pipe as separator
        const parts = input.split('|||');
        filepath = parts[0].trim();
        content = parts[1] || '';
      } else {
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(input);
          filepath = parsed.filepath;
          content = parsed.content;
        } catch {
          return res("Error: Input should be in format 'filepath|||content' or valid JSON with filepath and content properties");
        }
      }
      
      if (!filepath) {
        return res("Error: filepath is required");
      }
      
      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write file with proper encoding
      fs.writeFileSync(filepath, content, 'utf8');
      res(`File ${filepath} created successfully with ${content.length} characters`);
    } catch (error) {
      res(`Error creating file: ${error.message}`);
    }
  });
}

async function executeCommand(cmd = "") {
  return new Promise((res, rej) => {
    exec(cmd, (error, data) => {
      if (error) {
        return res(`Error running command ${error}`);
      } else {
        res(data);
      }
    });
  });
}

async function getGithubUserInfoByUsername(username = "") {
  const url = `https://api.github.com/users/${username.toLowerCase()}`;
  const { data } = await axios.get(url);
  return JSON.stringify({
    login: data.login,
    id: data.id,
    name: data.name,
    location: data.location,
    twitter_username: data.twitter_username,
    public_repos: data.public_repos,
    public_gists: data.public_gists,
    user_view_type: data.user_view_type,
    followers: data.followers,
    following: data.following,
  });
}

// Helper function to convert relative URLs to absolute
function toAbsolute(baseUrl, relativeUrl) {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch (error) {
    return relativeUrl;
  }
}

// Helper function to download CSS files
async function downloadCSS(url, outputDir) {
  try {
    const urlObj = new URL(url);
    let filename = path.basename(urlObj.pathname) || 'styles.css';
    
    // Ensure .css extension
    if (!filename.endsWith('.css')) {
      filename += '.css';
    }
    
    const localPath = path.join(outputDir, 'css', filename);
    await fs.ensureDir(path.dirname(localPath));
    
    const response = await axios.get(url, { responseType: 'stream' });
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(`./css/${filename}`));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download CSS ${url}:`, error.message);
    return null;
  }
}

// Helper function to download JS files
async function downloadJS(url, outputDir) {
  try {
    const urlObj = new URL(url);
    let filename = path.basename(urlObj.pathname) || 'script.js';
    
    // Ensure .js extension
    if (!filename.endsWith('.js')) {
      filename += '.js';
    }
    
    const localPath = path.join(outputDir, 'js', filename);
    await fs.ensureDir(path.dirname(localPath));
    
    const response = await axios.get(url, { responseType: 'stream' });
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(`./js/${filename}`));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download JS ${url}:`, error.message);
    return null;
  }
}

// Helper function to download generic assets (CSS, JS)
async function downloadGeneric(url, outputDir) {
  try {
    const urlObj = new URL(url);
    const filename = path.basename(urlObj.pathname) || 'asset';
    const localPath = path.join(outputDir, 'assets', filename);
    
    await fs.ensureDir(path.dirname(localPath));
    
    const response = await axios.get(url, { responseType: 'stream' });
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(`./assets/${filename}`));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download ${url}:`, error.message);
    return null;
  }
}

// Helper function to download images with smart naming
async function downloadImageSmart(src, baseUrl, outputDir) {
  try {
    const absoluteUrl = toAbsolute(baseUrl, src);
    const urlObj = new URL(absoluteUrl);
    let filename = path.basename(urlObj.pathname);
    
    // Handle API URLs and dynamic images
    if (urlObj.hostname.includes('github') || urlObj.hostname.includes('leetcode') || urlObj.hostname.includes('chart')) {
      // Create descriptive names for API-generated images
      if (urlObj.hostname.includes('ghchart.rshah.org')) {
        filename = 'github-chart.svg';
      } else if (urlObj.hostname.includes('leetcode.card.workers.dev')) {
        filename = 'leetcode-stats.png';
      } else if (urlObj.hostname.includes('github-readme-stats.vercel.app')) {
        filename = 'github-stats.svg';
      } else {
        filename = `api-image-${Date.now()}.jpg`;
      }
    }
    
    // Handle images without extensions
    if (!path.extname(filename)) {
      filename += '.jpg'; // Default extension
    }
    
    // Handle query parameters in filename
    if (filename.includes('?')) {
      filename = filename.split('?')[0];
    }
    
    const localPath = path.join(outputDir, 'images', filename);
    await fs.ensureDir(path.dirname(localPath));
    
    const response = await axios.get(absoluteUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(`./images/${filename}`));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download image ${src}:`, error.message);
    return null;
  }
}

// Function to validate all paths in the generated HTML
async function validatePaths(outputDir) {
  try {
    const htmlPath = path.join(outputDir, 'index.html');
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    const $ = cheerio.load(htmlContent);
    
    const issues = [];
    let validPaths = 0;
    let totalPaths = 0;
    
    // Check CSS files
    $('link[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('./')) {
        totalPaths++;
        const fullPath = path.join(outputDir, href.replace('./', ''));
        if (fs.existsSync(fullPath)) {
          validPaths++;
        } else {
          issues.push(`Missing CSS: ${href}`);
        }
      }
    });
    
    // Check JS files
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && src.startsWith('./')) {
        totalPaths++;
        const fullPath = path.join(outputDir, src.replace('./', ''));
        if (fs.existsSync(fullPath)) {
          validPaths++;
        } else {
          issues.push(`Missing JS: ${src}`);
        }
      }
    });
    
    // Check images
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && src.startsWith('./')) {
        totalPaths++;
        const fullPath = path.join(outputDir, src.replace('./', ''));
        if (fs.existsSync(fullPath)) {
          validPaths++;
        } else {
          issues.push(`Missing Image: ${src}`);
        }
      }
    });
    
    return {
      totalPaths,
      validPaths,
      issues,
      isValid: issues.length === 0
    };
  } catch (error) {
    return {
      totalPaths: 0,
      validPaths: 0,
      issues: [`Validation error: ${error.message}`],
      isValid: false
    };
  }
}

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
    
    // Find images (img tags, preload images, background images, etc.)
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
    
    // Also find background images in style attributes
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
          // Update background image in style attribute
          const currentStyle = $(asset.element).attr('style');
          const newStyle = currentStyle.replace(
            /url\(['"]?[^'")\s]+['"]?\)/,
            `url('${localPath}')`
          );
          $(asset.element).attr('style', newStyle);
        } else if (asset.type === 'preload') {
          // Update preload image href
          $(asset.element).attr("href", localPath);
        } else {
          // Regular img src
          $(asset.element).attr("src", localPath);
          $(asset.element).removeAttr("srcset"); // Remove srcset to avoid conflicts
        }
      }
    });
    
    // Wait for all images to download
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

// Function to validate and fix paths in cloned site
async function validateAndFixPaths(input = "") {
  try {
    const outputDir = input.trim();
    
    if (!outputDir) {
      return "Error: Please provide the directory path to validate";
    }
    
    const htmlPath = path.join(outputDir, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      return `Error: No index.html found in ${outputDir}`;
    }
    
    const validation = await validatePaths(outputDir);
    
    let result = `🔍 Path Validation Report for ${outputDir}:\n`;
    result += `📊 Total paths: ${validation.totalPaths}\n`;
    result += `✅ Valid paths: ${validation.validPaths}\n`;
    result += `❌ Invalid paths: ${validation.totalPaths - validation.validPaths}\n\n`;
    
    if (validation.issues.length > 0) {
      result += `⚠️ Issues found:\n${validation.issues.join('\n')}\n\n`;
      result += `💡 Suggestions:\n`;
      result += `- Check if all assets were downloaded properly\n`;
      result += `- Verify network connectivity during cloning\n`;
      result += `- Some external assets might be blocked by CORS\n`;
    } else {
      result += `🎉 All paths are valid! The cloned site should work properly.`;
    }
    
    return result;
  } catch (error) {
    return `❌ Error validating paths: ${error.message}`;
  }
}

const TOOL_MAP = {
  getWeatherDetailsByCity: getWeatherDetailsByCity,
  getGithubUserInfoByUsername: getGithubUserInfoByUsername,
  executeCommand: executeCommand,
  writeFileContent: writeFileContent,
  cloneSite: cloneSite,
  validateAndFixPaths: validateAndFixPaths,
};

const client = new OpenAI();

async function main() {
  // These api calls are stateless (Chain Of Thought)
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
    - getGithubUserInfoByUsername(username: string): Retuns the public info about the github user using github api
    - executeCommand(command: string): Takes a windows powershell command as arg and executes the command on user's machine and returns the output
    - writeFileContent(input: string): Creates a file with specified content. Input format: "filepath|||content" where ||| separates the file path from the content
    - cloneSite(input: string): Clones a website's HTML, CSS, and JS assets to a local directory. Input format: "siteUrl|||outputDir" or "siteUrl, outputDir". Creates separate folders: css/, js/, images/
    - validateAndFixPaths(input: string): Validates all relative paths in a cloned website directory and reports any issues

    IMPORTANT for file creation:
    - For creating HTML/CSS/JS files, ALWAYS use the writeFileContent tool instead of executeCommand with echo
    - The writeFileContent tool properly handles newlines, quotes, and special characters
    - When using writeFileContent, provide input in format: "path/to/file.html|||<html><body>content</body></html>"
    - For creating directories, use executeCommand with "mkdir foldername"
    

    Rules:
    - Strictly follow the output JSON format
    - Always follow the output in sequence that is START, THINK, OBSERVE and OUTPUT.
    - Always perform only one step at a time and wait for other step.
    - Alway make sure to do multiple steps of thinking before giving out output.
    - For every tool call always wait for the OBSERVE which contains the output from tool
    - parse a content after writing to file always remember to parse it
    - for cloning a site always remember to clone all assets
    - after cloning a site, ALWAYS validate paths using validateAndFixPaths tool
    - after cloning a site, always remember to update the HTML file paths
    - ensure that all asset URLs are relative to the new directory structure
    - when cloning is complete, automatically run path validation to ensure everything works


    Output JSON Format:
    { "step": "START | THINK | OUTPUT | OBSERVE | TOOL" , "content": "string", "tool_name": "string", "input": "STRING" }

    Example:
    User: Hey, can you tell me weather of Patiala?
    ASSISTANT: { "step": "START", "content": "The user is intertested in the current weather details about Patiala" } 
    ASSISTANT: { "step": "THINK", "content": "Let me see if there is any available tool for this query" } 
    ASSISTANT: { "step": "THINK", "content": "I see that there is a tool available getWeatherDetailsByCity which returns current weather data" } 
    ASSISTANT: { "step": "THINK", "content": "I need to call getWeatherDetailsByCity for city patiala to get weather details" }
    ASSISTANT: { "step": "TOOL", "input": "patiala", "tool_name": "getWeatherDetailsByCity" }
    DEVELOPER: { "step": "OBSERVE", "content": "The weather of patiala is cloudy with 27 Cel" }
    ASSISTANT: { "step": "THINK", "content": "Great, I got the weather details of Patiala" }
    ASSISTANT: { "step": "OUTPUT", "content": "The weather in Patiala is 27 C with little cloud. Please make sure to carry an umbrella with you. ☔️" }

    Example for cloning a site:
    user: Hey,clone this url https://tejas-portfolio.codeloom.software in folder name Portfolio;
    ASSISTANT: { "step": "START", "content": "The user wants to clone a website into a specific folder." }
    ASSISTANT: { "step": "THINK", "content": "I need to call the cloneSite function with the provided URL and folder name using the proper input format." }
    ASSISTANT: { "step": "TOOL", "input": "https://tejas-portfolio.codeloom.software|||Portfolio", "tool_name": "cloneSite" }
    DEVELOPER: { "step": "OBSERVE", "content": "✅ Successfully cloned https://tejas-portfolio.codeloom.software to Portfolio\n📁 Structure: css/ (1 files), js/ (10 files), images/ (21 files)\n🔍 Path validation: 32/32 valid paths" }
    ASSISTANT: { "step": "THINK", "content": "The website has been successfully cloned with proper folder structure. Now I should validate the paths to ensure everything is working correctly." }
    ASSISTANT: { "step": "TOOL", "input": "Portfolio", "tool_name": "validateAndFixPaths" }
    DEVELOPER: { "step": "OBSERVE", "content": "🔍 Path Validation Report for Portfolio:\n📊 Total paths: 32\n✅ Valid paths: 32\n❌ Invalid paths: 0\n\n🎉 All paths are valid! The cloned site should work properly." }
    ASSISTANT: { "step": "THINK", "content": "Perfect! All paths have been validated and the cloned website is fully functional." }
    ASSISTANT: { "step": "OUTPUT", "content": "The website has been successfully cloned into the Portfolio folder with organized structure: CSS files in css/ folder, JavaScript files in js/ folder, and images in images/ folder. All 32 asset paths have been validated and are working correctly. The cloned site is fully functional and ready to use." }

  `;

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content:
        'clone this website https://code.visualstudio.com to folder "vscode-clone"',
    },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messages,
    });

    const rawContent = response.choices[0].message.content;
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(rawContent);
    } catch (error) {
      console.log("❌ JSON parsing error:", error.message);
      console.log("📄 Raw content:", rawContent);
      
      // Try to extract valid JSON from the response
      const jsonMatch = rawContent.match(/\{[^}]*"step"[^}]*\}/);
      if (jsonMatch) {
        try {
          parsedContent = JSON.parse(jsonMatch[0]);
          console.log("✅ Recovered JSON:", parsedContent);
        } catch (recoveryError) {
          console.log("❌ Recovery failed, ending process");
          break;
        }
      } else {
        console.log("❌ No valid JSON found, ending process");
        break;
      }
    }

    messages.push({
      role: "assistant",
      content: JSON.stringify(parsedContent),
    });

    if (parsedContent.step === "START") {
      console.log(`🔥`, parsedContent.content);
      continue;
    }

    if (parsedContent.step === "THINK") {
      console.log(`\t🧠`, parsedContent.content);
      continue;
    }

    if (parsedContent.step === "TOOL") {
      const toolToCall = parsedContent.tool_name;
      if (!TOOL_MAP[toolToCall]) {
        messages.push({
          role: "developer",
          content: `There is no such tool as ${toolToCall}`,
        });
        continue;
      }

      const responseFromTool = await TOOL_MAP[toolToCall](parsedContent.input);
      console.log(
        `🛠️: ${toolToCall}(${parsedContent.input}) = `,
        responseFromTool
      );
      messages.push({
        role: "developer",
        content: JSON.stringify({ step: "OBSERVE", content: responseFromTool }),
      });
      continue;
    }

    if (parsedContent.step === "OUTPUT") {
      console.log(`🤖`, parsedContent.content);
      break;
    }
  }

  console.log("Done...");
}

main();
