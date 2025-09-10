class AnimeFireBackground {
  constructor() {
    this.init();
  }

  init() {
    this.setupContextMenus();
    this.setupDownloadListener();
    this.setupMessageListener();
  }

  setupContextMenus() {
    chrome.runtime.onInstalled.addListener(() => {
      // Context menu for episode links
      chrome.contextMenus.create({
        id: 'download-episode',
        title: 'Baixar este episódio',
        contexts: ['link'],
        targetUrlPatterns: ['*://animefire.plus/animes/*/*']
      });

      // Context menu for anime pages
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
        this.downloadEpisode(request.animeName, request.episodeNumber, request.quality)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
      }
      
      if (request.action === 'get-quality-links') {
        this.getQualityLinks(request.url)
          .then(links => sendResponse({ success: true, links }))
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

      // Download episodes with delay
      for (let i = 0; i < episodes.length; i++) {
        const { animeName, episodeNumber } = episodes[i];
        
        try {
          await this.downloadEpisode(animeName, episodeNumber, 'auto');
          
          if (i < episodes.length - 1) {
            await this.delay(20000); // 20 second delay
          }
        } catch (error) {
          console.error(`Error downloading episode ${episodeNumber}:`, error);
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
        filename: `anime_fire/${animeName}/${episodeNumber}_${selectedQuality.toLowerCase()}.mp4`,
        conflictAction: 'uniquify'
      });

      return { downloadId, quality: selectedQuality };
    } catch (error) {
      throw new Error(`Falha no download: ${error.message}`);
    }
  }

  async getQualityLinks(downloadUrl) {
    try {
      const response = await fetch(downloadUrl);
      const html = await response.text();
      
      // Parse HTML to extract quality links
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
    } catch (error) {
      throw new Error(`Erro ao obter links de qualidade: ${error.message}`);
    }
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
    const iconMap = {
      success: 'icons/icon48.png',
      error: 'icons/icon48.png',
      info: 'icons/icon48.png'
    };

    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconMap[type],
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