class AnimeFireBackground {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.minDelay = 2000; // Minimum 2 seconds between requests
    this.maxDelay = 8000; // Maximum 8 seconds between requests
    this.init();
  }

  init() {
    this.setupContextMenus();
    this.setupDownloadListener();
    this.setupMessageListener();
    this.setupRequestInterceptor();
  }

  setupRequestInterceptor() {
    // Intercept and modify requests to AnimeFire
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        const headers = details.requestHeaders || [];
        
        // Remove or modify headers that might identify us as an extension
        const filteredHeaders = headers.filter(header => 
          !['x-requested-with', 'x-chrome-extension'].includes(header.name.toLowerCase())
        );

        // Add/modify headers to look more like a regular browser
        const newHeaders = [
          ...filteredHeaders,
          { name: 'User-Agent', value: this.getRandomUserAgent() },
          { name: 'Accept', value: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' },
          { name: 'Accept-Language', value: 'pt-BR,pt;q=0.9,en;q=0.8' },
          { name: 'Accept-Encoding', value: 'gzip, deflate, br' },
          { name: 'DNT', value: '1' },
          { name: 'Connection', value: 'keep-alive' },
          { name: 'Upgrade-Insecure-Requests', value: '1' },
          { name: 'Sec-Fetch-Dest', value: 'document' },
          { name: 'Sec-Fetch-Mode', value: 'navigate' },
          { name: 'Sec-Fetch-Site', value: 'none' },
          { name: 'Cache-Control', value: 'max-age=0' }
        ];

        return { requestHeaders: newHeaders };
      },
      { urls: ['*://animefire.plus/*', '*://*.animefire.plus/*'] },
      ['blocking', 'requestHeaders']
    );
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async makeStealthRequest(url, options = {}) {
    // Implement dynamic delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const dynamicDelay = this.calculateDynamicDelay();
    
    if (timeSinceLastRequest < dynamicDelay) {
      await this.delay(dynamicDelay - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;

    const stealthOptions = {
      method: 'GET',
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://animefire.plus/',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, stealthOptions);
      
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait longer and retry
          await this.delay(this.getBackoffDelay());
          return this.makeStealthRequest(url, options);
        }
        if (response.status === 403 || response.status === 406) {
          // Blocked - try with different approach
          return this.makeProxyRequest(url, options);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      console.error('Stealth request failed:', error);
      // Try alternative approach
      return this.makeAlternativeRequest(url, options);
    }
  }

  calculateDynamicDelay() {
    // Increase delay based on request count to avoid detection
    const baseDelay = this.minDelay;
    const additionalDelay = Math.min(this.requestCount * 500, this.maxDelay - baseDelay);
    const randomFactor = Math.random() * 2000; // Add randomness
    return baseDelay + additionalDelay + randomFactor;
  }

  getBackoffDelay() {
    // Exponential backoff for rate limiting
    return Math.min(30000, 5000 * Math.pow(2, Math.min(this.requestCount / 10, 3)));
  }

  async makeProxyRequest(url, options = {}) {
    // Try to use a different approach when blocked
    try {
      // Method 1: Try with different headers
      const alternativeHeaders = {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity',
        'Connection': 'close',
        'Cache-Control': 'no-cache'
      };

      const response = await fetch(url, {
        ...options,
        headers: { ...alternativeHeaders, ...options.headers }
      });

      if (response.ok) {
        return response;
      }
    } catch (error) {
      console.error('Proxy request failed:', error);
    }

    throw new Error('All request methods failed');
  }

  async makeAlternativeRequest(url, options = {}) {
    // Last resort: try with minimal headers
    try {
      await this.delay(5000); // Wait 5 seconds before retry
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.getRandomUserAgent()
        }
      });

      return response;
    } catch (error) {
      throw new Error(`Alternative request failed: ${error.message}`);
    }
  }

  setupContextMenus() {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: 'download-episode',
        title: 'Baixar este episódio',
        contexts: ['link'],
        targetUrlPatterns: ['*://animefire.plus/animes/*/*']
      });

      chrome.contextMenus.create({
        id: 'download-anime',
        title: 'Baixar todos os episódios',
        contexts: ['page'],
        documentUrlPatterns: ['*://animefire.plus/animes/*']
      });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'download-episode') {
        this.handleEpisodeDownload(info.linkUrl, tab);
      } else if (info.menuItemId === 'download-anime') {
        this.handleAnimeDownload(tab);
      }
    });
  }

  setupDownloadListener() {
    chrome.downloads.onChanged.addListener((downloadDelta) => {
      if (downloadDelta.state && downloadDelta.state.current === 'complete') {
        this.showNotification('Download concluído!', 'success');
      } else if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
        this.showNotification('Download interrompido', 'error');
      }
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'download-episode') {
        this.downloadEpisodeFromMessage(request)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      }
      
      if (request.action === 'get-quality-links') {
        this.getQualityLinks(request.url)
          .then(links => sendResponse({ success: true, links }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      }

      if (request.action === 'stealth-fetch') {
        this.makeStealthRequest(request.url, request.options)
          .then(response => response.text())
          .then(html => sendResponse({ success: true, html }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      }
    });
  }

  async handleEpisodeDownload(linkUrl, tab) {
    const match = linkUrl.match(/animes\/([^\/]+)\/(\d+)/);
    if (match) {
      const animeName = match[1];
      const episodeNumber = match[2];
      
      try {
        await this.downloadEpisode(animeName, episodeNumber, 'auto');
        this.showNotification(`Download iniciado: ${animeName} - Episódio ${episodeNumber}`, 'success');
      } catch (error) {
        this.showNotification(`Erro no download: ${error.message}`, 'error');
      }
    }
  }

  async handleAnimeDownload(tab) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: this.extractEpisodeLinks
      });

      const episodes = results[0].result;
      
      if (episodes.length === 0) {
        this.showNotification('Nenhum episódio encontrado', 'error');
        return;
      }

      this.showNotification(`Iniciando download de ${episodes.length} episódios...`, 'info');

      for (let i = 0; i < episodes.length; i++) {
        const { animeName, episodeNumber } = episodes[i];
        
        try {
          await this.downloadEpisode(animeName, episodeNumber, 'auto');
          
          if (i < episodes.length - 1) {
            const delay = this.calculateDynamicDelay();
            await this.delay(delay);
          }
        } catch (error) {
          console.error(`Error downloading episode ${episodeNumber}:`, error);
          await this.delay(10000); // Wait longer on error
        }
      }
      
      this.showNotification('Todos os downloads foram iniciados!', 'success');
    } catch (error) {
      this.showNotification(`Erro: ${error.message}`, 'error');
    }
  }

  extractEpisodeLinks() {
    const episodes = [];
    const episodeLinks = document.querySelectorAll('.lEp.epT.divNumEp, .episode-link, a[href*="/animes/"]');
    
    episodeLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.match(/animes\/[^\/]+\/\d+/)) {
        const match = href.match(/animes\/([^\/]+)\/(\d+)/);
        if (match) {
          episodes.push({
            animeName: match[1],
            episodeNumber: match[2]
          });
        }
      }
    });
    
    return episodes;
  }

  async downloadEpisode(animeName, episodeNumber, quality = 'auto') {
    const downloadUrl = `https://animefire.plus/download/${animeName}/${episodeNumber}`;
    
    try {
      const qualityLinks = await this.getQualityLinks(downloadUrl);
      
      let selectedQuality = quality;
      if (quality === 'auto') {
        selectedQuality = this.getBestQuality(qualityLinks);
      }

      if (!qualityLinks[selectedQuality]) {
        throw new Error(`Qualidade ${selectedQuality} não disponível`);
      }

      const downloadId = await chrome.downloads.download({
        url: qualityLinks[selectedQuality],
        filename: `anime_fire/${animeName.replace(/[^a-zA-Z0-9]/g, '_')}/${episodeNumber}_${selectedQuality.toLowerCase()}.mp4`,
        conflictAction: 'uniquify'
      });

      return { downloadId, quality: selectedQuality };
    } catch (error) {
      throw new Error(`Falha no download: ${error.message}`);
    }
  }

  async downloadEpisodeFromMessage(request) {
    try {
      const downloadId = await chrome.downloads.download({
        url: request.url,
        filename: `anime_fire/${request.animeName.replace(/[^a-zA-Z0-9]/g, '_')}/${request.episodeNumber}_${request.quality.toLowerCase()}.mp4`,
        conflictAction: 'uniquify'
      });

      return { downloadId, quality: request.quality };
    } catch (error) {
      throw new Error(`Falha no download: ${error.message}`);
    }
  }

  async getQualityLinks(downloadUrl) {
    try {
      const response = await this.makeStealthRequest(downloadUrl);
      const html = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = {};
      
      // Try multiple selectors to find quality links
      const selectors = [
        'a[href*=".mp4"]',
        'a[href*="download"]',
        'a[href*="stream"]',
        '.quality-link',
        '.download-link'
      ];

      for (const selector of selectors) {
        const qualityLinks = doc.querySelectorAll(selector);
        qualityLinks.forEach(link => {
          const text = link.textContent.trim();
          const href = link.getAttribute('href');
          
          if (['SD', 'HD', 'F-HD', 'FullHD'].includes(text) && href) {
            links[text] = href;
          }
        });
        
        if (Object.keys(links).length > 0) break;
      }

      // If no quality links found, try alternative parsing
      if (Object.keys(links).length === 0) {
        return this.parseAlternativeQualityLinks(html);
      }
      
      return links;
    } catch (error) {
      throw new Error(`Erro ao obter links de qualidade: ${error.message}`);
    }
  }

  parseAlternativeQualityLinks(html) {
    const links = {};
    
    // Try to find video URLs in script tags or data attributes
    const scriptMatches = html.match(/(?:src|url|link)["']\s*:\s*["']([^"']*\.mp4[^"']*)["']/gi);
    if (scriptMatches) {
      scriptMatches.forEach((match, index) => {
        const urlMatch = match.match(/["']([^"']*\.mp4[^"']*)["']/);
        if (urlMatch) {
          const quality = index === 0 ? 'HD' : `Quality${index}`;
          links[quality] = urlMatch[1];
        }
      });
    }

    // Try to find quality indicators in the HTML
    const qualityMatches = html.match(/(SD|HD|F-HD|FullHD).*?href\s*=\s*["']([^"']+)["']/gi);
    if (qualityMatches) {
      qualityMatches.forEach(match => {
        const qualityMatch = match.match(/(SD|HD|F-HD|FullHD)/);
        const urlMatch = match.match(/href\s*=\s*["']([^"']+)["']/);
        
        if (qualityMatch && urlMatch) {
          links[qualityMatch[1]] = urlMatch[1];
        }
      });
    }

    return links;
  }

  getBestQuality(qualityLinks) {
    const priorities = ['FullHD', 'F-HD', 'HD', 'SD'];
    for (const quality of priorities) {
      if (qualityLinks[quality]) {
        return quality;
      }
    }
    return Object.keys(qualityLinks)[0];
  }

  showNotification(message, type = 'info') {
    chrome.notifications.create({
      type: 'basic',
      title: 'AnimeFire Downloader',
      message: message
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize background script
new AnimeFireBackground();