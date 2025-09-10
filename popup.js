class AnimeFire {
  constructor() {
    this.currentTab = null;
    this.settings = {
      downloadDelay: 20,
      downloadAllQualities: false,
      autoDetect: true,
      showNotifications: true
    };
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupTabs();
    await this.detectCurrentPage();
  }

  async loadSettings() {
    const stored = await chrome.storage.sync.get(this.settings);
    this.settings = { ...this.settings, ...stored };
    this.updateSettingsUI();
  }

  async saveSettings() {
    await chrome.storage.sync.set(this.settings);
  }

  updateSettingsUI() {
    document.getElementById('download-delay').value = this.settings.downloadDelay;
    document.getElementById('download-all-qualities').checked = this.settings.downloadAllQualities;
    document.getElementById('auto-detect').checked = this.settings.autoDetect;
    document.getElementById('show-notifications').checked = this.settings.showNotifications;
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Download buttons
    document.getElementById('download-current').addEventListener('click', () => {
      this.downloadCurrentEpisode();
    });

    document.getElementById('download-anime').addEventListener('click', () => {
      this.downloadAnimeRange();
    });

    document.getElementById('download-batch').addEventListener('click', () => {
      this.downloadBatch();
    });

    // Utility buttons
    document.getElementById('select-all').addEventListener('click', () => {
      this.selectAllEpisodes();
    });

    // Settings
    document.getElementById('download-delay').addEventListener('change', (e) => {
      this.settings.downloadDelay = parseInt(e.target.value);
      this.saveSettings();
    });

    document.getElementById('download-all-qualities').addEventListener('change', (e) => {
      this.settings.downloadAllQualities = e.target.checked;
      this.saveSettings();
    });

    document.getElementById('auto-detect').addEventListener('change', (e) => {
      this.settings.autoDetect = e.target.checked;
      this.saveSettings();
    });

    document.getElementById('show-notifications').addEventListener('change', (e) => {
      this.settings.showNotifications = e.target.checked;
      this.saveSettings();
    });

    document.getElementById('reset-settings').addEventListener('click', () => {
      this.resetSettings();
    });

    // Progress modal
    document.getElementById('close-progress').addEventListener('click', () => {
      document.getElementById('download-progress').style.display = 'none';
    });
  }

  setupTabs() {
    this.switchTab('current');
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  async detectCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;

      if (!tab.url.includes('animefire.plus')) {
        this.showNoAnime();
        return;
      }

      // Inject content script to analyze page
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: this.analyzePageContent
      });

      const pageData = results[0].result;
      this.updatePageInfo(pageData);
    } catch (error) {
      console.error('Error detecting page:', error);
      this.showNoAnime();
    }
  }

  analyzePageContent() {
    const url = window.location.href;
    const pageData = {
      type: 'unknown',
      url: url
    };

    // Check if it's an episode page
    const episodeMatch = url.match(/animes\/([^\/]+)\/(\d+)/);
    if (episodeMatch) {
      pageData.type = 'episode';
      pageData.animeName = episodeMatch[1].replace(/-/g, ' ');
      pageData.episodeNumber = episodeMatch[2];
      
      // Try to get anime title from page
      const titleElement = document.querySelector('h1, .anime-title, .episode-title');
      if (titleElement) {
        pageData.animeTitle = titleElement.textContent.trim();
      }
    }
    // Check if it's an anime main page
    else if (url.includes('/animes/') && !url.includes('/episodios')) {
      pageData.type = 'anime';
      
      // Extract anime name from URL
      const animeMatch = url.match(/animes\/([^\/]+)/);
      if (animeMatch) {
        pageData.animeName = animeMatch[1].replace(/-/g, ' ');
      }

      // Get anime title and episode count
      const titleElement = document.querySelector('h1, .anime-title');
      if (titleElement) {
        pageData.animeTitle = titleElement.textContent.trim();
      }

      // Count episodes
      const episodeLinks = document.querySelectorAll('.lEp.epT.divNumEp, .episode-link, a[href*="/animes/"]');
      const episodes = [];
      episodeLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.match(/animes\/[^\/]+\/\d+/)) {
          const epMatch = href.match(/\/(\d+)$/);
          if (epMatch) {
            episodes.push(parseInt(epMatch[1]));
          }
        }
      });

      if (episodes.length > 0) {
        pageData.episodeCount = Math.max(...episodes);
        pageData.availableEpisodes = episodes.sort((a, b) => a - b);
      }
    }

    return pageData;
  }

  updatePageInfo(pageData) {
    const statusElement = document.getElementById('page-status');
    const typeElement = document.getElementById('page-type');

    if (pageData.type === 'episode') {
      statusElement.style.background = '#28a745';
      typeElement.textContent = 'Página de Episódio Detectada';
      this.showEpisodeInfo(pageData);
    } else if (pageData.type === 'anime') {
      statusElement.style.background = '#17a2b8';
      typeElement.textContent = 'Página de Anime Detectada';
      this.showAnimeInfo(pageData);
    } else {
      statusElement.style.background = '#ffc107';
      typeElement.textContent = 'Página não reconhecida';
      this.showNoAnime();
    }
  }

  showEpisodeInfo(data) {
    document.getElementById('no-anime').style.display = 'none';
    document.getElementById('anime-info').style.display = 'none';
    document.getElementById('episode-info').style.display = 'block';

    document.getElementById('anime-name').textContent = data.animeTitle || data.animeName;
    document.getElementById('episode-number').textContent = data.episodeNumber;
  }

  showAnimeInfo(data) {
    document.getElementById('no-anime').style.display = 'none';
    document.getElementById('episode-info').style.display = 'none';
    document.getElementById('anime-info').style.display = 'block';

    document.getElementById('anime-title').textContent = data.animeTitle || data.animeName;
    document.getElementById('episode-count').textContent = data.episodeCount || 'Desconhecido';

    if (data.episodeCount) {
      document.getElementById('end-episode').value = data.episodeCount;
      document.getElementById('start-episode').value = 1;
    }
  }

  showNoAnime() {
    document.getElementById('episode-info').style.display = 'none';
    document.getElementById('anime-info').style.display = 'none';
    document.getElementById('no-anime').style.display = 'block';
  }

  selectAllEpisodes() {
    const endEpisode = document.getElementById('episode-count').textContent;
    if (endEpisode !== 'Desconhecido') {
      document.getElementById('start-episode').value = 1;
      document.getElementById('end-episode').value = endEpisode;
    }
  }

  async downloadCurrentEpisode() {
    const quality = document.getElementById('quality-select').value;
    const animeName = document.getElementById('anime-name').textContent;
    const episodeNumber = document.getElementById('episode-number').textContent;

    if (!animeName || !episodeNumber) {
      this.showNotification('Erro: Informações do episódio não encontradas', 'error');
      return;
    }

    this.showProgressModal();
    await this.downloadEpisode(animeName, episodeNumber, quality);
  }

  async downloadAnimeRange() {
    const startEp = parseInt(document.getElementById('start-episode').value);
    const endEp = parseInt(document.getElementById('end-episode').value);
    const quality = document.getElementById('anime-quality-select').value;
    const animeName = document.getElementById('anime-title').textContent;

    if (!startEp || !endEp || startEp > endEp) {
      this.showNotification('Erro: Range de episódios inválido', 'error');
      return;
    }

    this.showProgressModal();
    
    for (let ep = startEp; ep <= endEp; ep++) {
      await this.downloadEpisode(animeName, ep.toString(), quality);
      if (ep < endEp) {
        await this.delay(this.settings.downloadDelay * 1000);
      }
    }
  }

  async downloadBatch() {
    const links = document.getElementById('batch-links').value.trim();
    const quality = document.getElementById('batch-quality-select').value;

    if (!links) {
      this.showNotification('Erro: Nenhum link fornecido', 'error');
      return;
    }

    const linkList = links.split('\n').filter(link => link.trim());
    this.showProgressModal();

    for (let i = 0; i < linkList.length; i++) {
      const link = linkList[i].trim();
      const match = link.match(/animes\/([^\/]+)\/(\d+)/);
      
      if (match) {
        const animeName = match[1].replace(/-/g, ' ');
        const episodeNumber = match[2];
        await this.downloadEpisode(animeName, episodeNumber, quality);
        
        if (i < linkList.length - 1) {
          await this.delay(this.settings.downloadDelay * 1000);
        }
      } else {
        this.addProgressItem(`Link inválido: ${link}`, 'error');
      }
    }
  }

  async downloadEpisode(animeName, episodeNumber, quality) {
    const progressId = `${animeName}-${episodeNumber}`;
    this.addProgressItem(`${animeName} - Episódio ${episodeNumber}`, 'downloading', progressId);

    try {
      // Simulate download process (in real extension, this would make actual requests)
      const downloadUrl = this.generateDownloadUrl(animeName, episodeNumber);
      const qualityLinks = await this.getQualityLinks(downloadUrl);
      
      let selectedQuality = quality;
      if (quality === 'auto') {
        selectedQuality = this.getBestQuality(qualityLinks);
      }

      if (qualityLinks[selectedQuality]) {
        // Use Chrome downloads API
        await chrome.downloads.download({
          url: qualityLinks[selectedQuality],
          filename: `anime_fire/${animeName}/${episodeNumber}_${selectedQuality.toLowerCase()}.mp4`
        });

        this.updateProgressItem(progressId, 'completed');
        this.showNotification(`Download iniciado: ${animeName} - Ep ${episodeNumber}`, 'success');
      } else {
        throw new Error(`Qualidade ${selectedQuality} não disponível`);
      }
    } catch (error) {
      this.updateProgressItem(progressId, 'error');
      this.showNotification(`Erro no download: ${error.message}`, 'error');
    }
  }

  generateDownloadUrl(animeName, episodeNumber) {
    const urlName = animeName.toLowerCase().replace(/\s+/g, '-');
    return `https://animefire.plus/download/${urlName}/${episodeNumber}`;
  }

  async getQualityLinks(downloadUrl) {
    // This would normally make a request to the download page and parse quality links
    // For demo purposes, returning mock data
    return {
      'FullHD': `${downloadUrl}/fullhd.mp4`,
      'F-HD': `${downloadUrl}/fhd.mp4`,
      'HD': `${downloadUrl}/hd.mp4`,
      'SD': `${downloadUrl}/sd.mp4`
    };
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

  showProgressModal() {
    document.getElementById('download-progress').style.display = 'flex';
    document.getElementById('progress-list').innerHTML = '';
  }

  addProgressItem(text, status, id = null) {
    const progressList = document.getElementById('progress-list');
    const item = document.createElement('div');
    item.className = `progress-item ${status}`;
    if (id) item.id = `progress-${id}`;
    
    item.innerHTML = `
      <span>${text}</span>
      <span class="progress-status">${this.getStatusText(status)}</span>
    `;
    
    progressList.appendChild(item);
  }

  updateProgressItem(id, status) {
    const item = document.getElementById(`progress-${id}`);
    if (item) {
      item.className = `progress-item ${status}`;
      item.querySelector('.progress-status').textContent = this.getStatusText(status);
    }
  }

  getStatusText(status) {
    const statusMap = {
      'downloading': 'Baixando...',
      'completed': 'Concluído',
      'error': 'Erro'
    };
    return statusMap[status] || status;
  }

  showNotification(message, type = 'info') {
    if (!this.settings.showNotifications) return;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 16px',
      borderRadius: '6px',
      color: 'white',
      fontWeight: '500',
      zIndex: '10000',
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    });

    // Set background color based on type
    const colors = {
      success: '#28a745',
      error: '#dc3545',
      info: '#17a2b8'
    };
    notification.style.background = colors[type] || colors.info;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  async resetSettings() {
    this.settings = {
      downloadDelay: 20,
      downloadAllQualities: false,
      autoDetect: true,
      showNotifications: true
    };
    await this.saveSettings();
    this.updateSettingsUI();
    this.showNotification('Configurações restauradas', 'success');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AnimeFire();
});