class AnimeFireContentScript {
  constructor() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.init();
  }

  init() {
    // Wait a bit before adding buttons to avoid detection
    setTimeout(() => {
      this.addDownloadButtons();
      this.setupPageObserver();
    }, Math.random() * 3000 + 1000); // Random delay between 1-4 seconds
  }

  addDownloadButtons() {
    if (this.isEpisodePage()) {
      this.addEpisodeDownloadButton();
    }
    
    if (this.isAnimePage()) {
      this.addAnimeDownloadButtons();
    }
  }

  isEpisodePage() {
    return window.location.href.match(/animes\/[^\/]+\/\d+/);
  }

  isAnimePage() {
    return window.location.href.includes('/animes/') && 
           !window.location.href.includes('/episodios') &&
           !this.isEpisodePage();
  }

  addEpisodeDownloadButton() {
    const videoContainer = document.querySelector('.video-container, .player-container, #video-player, .video-player');
    const titleContainer = document.querySelector('h1, .episode-title, .anime-title, .title');
    const contentContainer = document.querySelector('.content, .main-content, .episode-content');
    
    const targetContainer = videoContainer || titleContainer || contentContainer;
    
    if (targetContainer && !document.querySelector('.af-download-main')) {
      const downloadBtn = this.createDownloadButton('Baixar Episódio', () => {
        this.downloadCurrentEpisode();
      });
      
      // Try to insert in a good position
      if (targetContainer.parentNode) {
        targetContainer.parentNode.insertBefore(downloadBtn, targetContainer.nextSibling);
      } else {
        document.body.appendChild(downloadBtn);
      }
    }
  }

  addAnimeDownloadButtons() {
    const animeInfo = document.querySelector('.anime-info, .anime-details, .info, h1, .title');
    if (animeInfo && !document.querySelector('.af-download-all')) {
      const downloadAllBtn = this.createDownloadButton('Baixar Todos os Episódios', () => {
        this.downloadAllEpisodes();
      });
      downloadAllBtn.classList.add('af-download-all');
      
      if (animeInfo.parentNode) {
        animeInfo.parentNode.insertBefore(downloadAllBtn, animeInfo.nextSibling);
      }
    }

    // Add individual download buttons with better selectors
    const episodeSelectors = [
      '.lEp.epT.divNumEp',
      '.episode-link',
      '.episode-item',
      '.ep-item',
      'a[href*="/animes/"][href*="/"]'
    ];

    let episodeLinks = [];
    for (const selector of episodeSelectors) {
      episodeLinks = document.querySelectorAll(selector);
      if (episodeLinks.length > 0) break;
    }

    episodeLinks.forEach(link => {
      if (!link.querySelector('.af-download-btn') && link.getAttribute('href')) {
        const href = link.getAttribute('href');
        if (href.match(/animes\/[^\/]+\/\d+/)) {
          const downloadBtn = this.createSmallDownloadButton(() => {
            const match = href.match(/animes\/([^\/]+)\/(\d+)/);
            if (match) {
              this.downloadEpisode(match[1], match[2]);
            }
          });
          
          // Position the button better
          link.style.position = 'relative';
          link.appendChild(downloadBtn);
        }
      }
    });
  }

  createDownloadButton(text, onClick) {
    const button = document.createElement('button');
    button.className = 'af-download-btn af-download-main';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
      ${text}
    `;
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return button;
  }

  createSmallDownloadButton(onClick) {
    const button = document.createElement('button');
    button.className = 'af-download-btn af-download-small';
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
    `;
    button.title = 'Baixar este episódio';
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return button;
  }

  async downloadCurrentEpisode() {
    const match = window.location.href.match(/animes\/([^\/]+)\/(\d+)/);
    if (match) {
      await this.downloadEpisode(match[1], match[2]);
    }
  }

  async downloadAllEpisodes() {
    const episodeLinks = this.getAllEpisodeLinks();
    const episodes = [];
    
    episodeLinks.forEach(link => {
      const href = link.getAttribute('href');
      const match = href.match(/animes\/([^\/]+)\/(\d+)/);
      if (match) {
        episodes.push({ anime: match[1], episode: match[2] });
      }
    });

    if (episodes.length === 0) {
      this.showNotification('Nenhum episódio encontrado', 'error');
      return;
    }

    this.showNotification(`Iniciando download de ${episodes.length} episódios...`, 'info');

    for (let i = 0; i < episodes.length; i++) {
      const { anime, episode } = episodes[i];
      await this.downloadEpisode(anime, episode);
      
      if (i < episodes.length - 1) {
        const delay = this.calculateDynamicDelay();
        await this.delay(delay);
      }
    }
  }

  getAllEpisodeLinks() {
    const selectors = [
      '.lEp.epT.divNumEp',
      '.episode-link',
      '.episode-item',
      '.ep-item',
      'a[href*="/animes/"]'
    ];

    for (const selector of selectors) {
      const links = document.querySelectorAll(selector);
      if (links.length > 0) {
        return Array.from(links).filter(link => {
          const href = link.getAttribute('href');
          return href && href.match(/animes\/[^\/]+\/\d+/);
        });
      }
    }
    
    return [];
  }

  async downloadEpisode(animeName, episodeNumber) {
    try {
      this.showNotification(`Iniciando download: ${animeName} - Episódio ${episodeNumber}`, 'info');
      
      const downloadUrl = `https://animefire.plus/download/${animeName}/${episodeNumber}`;
      
      // Use stealth request through background script
      const response = await this.sendMessage({
        action: 'stealth-fetch',
        url: downloadUrl
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      const qualityLinks = this.extractQualityLinks(response.html);
      const bestQuality = this.getBestQuality(qualityLinks);
      
      if (qualityLinks[bestQuality]) {
        const downloadResponse = await this.sendMessage({
          action: 'download-episode',
          animeName: animeName,
          episodeNumber: episodeNumber,
          quality: bestQuality,
          url: qualityLinks[bestQuality]
        });

        if (downloadResponse.success) {
          this.showNotification(`Download iniciado: ${animeName} - Ep ${episodeNumber} (${bestQuality})`, 'success');
        } else {
          throw new Error(downloadResponse.error);
        }
      } else {
        throw new Error('Nenhuma qualidade disponível');
      }
    } catch (error) {
      this.showNotification(`Erro no download: ${error.message}`, 'error');
      console.error('Download error:', error);
    }
  }

  extractQualityLinks(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = {};
    
    // Try multiple approaches to find quality links
    const approaches = [
      () => {
        const qualityLinks = doc.querySelectorAll('a[href]');
        qualityLinks.forEach(link => {
          const text = link.textContent.trim();
          if (['SD', 'HD', 'F-HD', 'FullHD'].includes(text)) {
            links[text] = link.getAttribute('href');
          }
        });
      },
      () => {
        const videoLinks = doc.querySelectorAll('a[href*=".mp4"], a[href*="download"], a[href*="stream"]');
        videoLinks.forEach((link, index) => {
          const href = link.getAttribute('href');
          const text = link.textContent.trim();
          
          if (href && (href.includes('.mp4') || href.includes('download'))) {
            const quality = ['SD', 'HD', 'F-HD', 'FullHD'].includes(text) ? text : `Quality${index}`;
            links[quality] = href;
          }
        });
      },
      () => {
        // Parse from script tags or data attributes
        const scripts = doc.querySelectorAll('script');
        scripts.forEach(script => {
          const content = script.textContent;
          const matches = content.match(/(?:src|url|link)["']\s*:\s*["']([^"']*\.mp4[^"']*)["']/gi);
          if (matches) {
            matches.forEach((match, index) => {
              const urlMatch = match.match(/["']([^"']*\.mp4[^"']*)["']/);
              if (urlMatch) {
                links[`Quality${index}`] = urlMatch[1];
              }
            });
          }
        });
      }
    ];

    for (const approach of approaches) {
      try {
        approach();
        if (Object.keys(links).length > 0) break;
      } catch (error) {
        console.error('Error in quality extraction approach:', error);
      }
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

  calculateDynamicDelay() {
    this.requestCount++;
    const baseDelay = 3000; // 3 seconds base
    const additionalDelay = Math.min(this.requestCount * 1000, 15000); // Up to 15 seconds additional
    const randomFactor = Math.random() * 5000; // Random 0-5 seconds
    return baseDelay + additionalDelay + randomFactor;
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.af-notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `af-notification af-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }

  setupPageObserver() {
    let timeoutId;
    
    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        this.addDownloadButtons();
      }, 1000); // Debounce to avoid too many calls
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize with random delay to avoid detection patterns
const initDelay = Math.random() * 2000 + 500; // 0.5-2.5 seconds

setTimeout(() => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new AnimeFireContentScript();
    });
  } else {
    new AnimeFireContentScript();
  }
}, initDelay);