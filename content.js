class AnimeFireContentScript {
  constructor() {
    this.init();
  }

  init() {
    this.addDownloadButtons();
    this.setupPageObserver();
  }

  addDownloadButtons() {
    // Add download button to episode pages
    if (this.isEpisodePage()) {
      this.addEpisodeDownloadButton();
    }
    
    // Add download buttons to anime main pages
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
    // Find a good place to add the download button
    const videoContainer = document.querySelector('.video-container, .player-container, #video-player');
    const titleContainer = document.querySelector('h1, .episode-title, .anime-title');
    
    if (videoContainer || titleContainer) {
      const downloadBtn = this.createDownloadButton('Baixar Episódio', () => {
        this.downloadCurrentEpisode();
      });
      
      const container = videoContainer || titleContainer;
      container.parentNode.insertBefore(downloadBtn, container.nextSibling);
    }
  }

  addAnimeDownloadButtons() {
    // Add download all button
    const animeInfo = document.querySelector('.anime-info, .anime-details, h1');
    if (animeInfo) {
      const downloadAllBtn = this.createDownloadButton('Baixar Todos os Episódios', () => {
        this.downloadAllEpisodes();
      });
      animeInfo.parentNode.insertBefore(downloadAllBtn, animeInfo.nextSibling);
    }

    // Add individual download buttons to episode list
    const episodeLinks = document.querySelectorAll('.lEp.epT.divNumEp, .episode-link');
    episodeLinks.forEach(link => {
      if (!link.querySelector('.af-download-btn')) {
        const downloadBtn = this.createSmallDownloadButton(() => {
          const href = link.getAttribute('href');
          const match = href.match(/animes\/([^\/]+)\/(\d+)/);
          if (match) {
            this.downloadEpisode(match[1], match[2]);
          }
        });
        link.appendChild(downloadBtn);
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
    button.addEventListener('click', onClick);
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
    const episodeLinks = document.querySelectorAll('.lEp.epT.divNumEp, .episode-link');
    const episodes = [];
    
    episodeLinks.forEach(link => {
      const href = link.getAttribute('href');
      const match = href.match(/animes\/([^\/]+)\/(\d+)/);
      if (match) {
        episodes.push({ anime: match[1], episode: match[2] });
      }
    });

    for (let i = 0; i < episodes.length; i++) {
      const { anime, episode } = episodes[i];
      await this.downloadEpisode(anime, episode);
      
      if (i < episodes.length - 1) {
        await this.delay(20000); // 20 second delay
      }
    }
  }

  async downloadEpisode(animeName, episodeNumber) {
    try {
      const downloadUrl = `https://animefire.plus/download/${animeName}/${episodeNumber}`;
      
      // Show loading state
      this.showNotification(`Iniciando download: ${animeName} - Episódio ${episodeNumber}`, 'info');
      
      // Get quality links
      const response = await fetch(downloadUrl);
      const html = await response.text();
      const qualityLinks = this.extractQualityLinks(html);
      
      // Get best quality
      const bestQuality = this.getBestQuality(qualityLinks);
      
      if (qualityLinks[bestQuality]) {
        // Send message to background script to handle download
        chrome.runtime.sendMessage({
          action: 'download-episode',
          animeName: animeName,
          episodeNumber: episodeNumber,
          quality: bestQuality,
          url: qualityLinks[bestQuality]
        });
        
        this.showNotification(`Download iniciado: ${animeName} - Ep ${episodeNumber} (${bestQuality})`, 'success');
      } else {
        throw new Error('Nenhuma qualidade disponível');
      }
    } catch (error) {
      this.showNotification(`Erro no download: ${error.message}`, 'error');
    }
  }

  extractQualityLinks(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = {};
    
    const qualityLinks = doc.querySelectorAll('a[href]');
    qualityLinks.forEach(link => {
      const text = link.textContent.trim();
      if (['SD', 'HD', 'F-HD', 'FullHD'].includes(text)) {
        links[text] = link.getAttribute('href');
      }
    });
    
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
    // Remove existing notifications
    const existing = document.querySelectorAll('.af-notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `af-notification af-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  setupPageObserver() {
    // Watch for page changes (SPA navigation)
    const observer = new MutationObserver(() => {
      this.addDownloadButtons();
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

// Initialize content script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AnimeFireContentScript();
  });
} else {
  new AnimeFireContentScript();
}