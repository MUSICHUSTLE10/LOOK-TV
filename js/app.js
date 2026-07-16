// LOOK TV — Multi-API IPTV + Radio Player

const API = 'https://iptv-org.github.io/api';
const RADIO_API = 'https://de1.api.radio-browser.info/json';

const EXTRA_SOURCES = [
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/gb.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/it.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sn.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ci.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/cm.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ma.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/dz.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tn.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tr.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ru.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pt.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/nl.m3u',
];

let allChannels = [];
let allRadios = [];
let filteredChannels = [];
let filteredRadios = [];
let countries = [];
let currentHls = null;
let currentChannel = null;
let currentIndex = -1;
let currentRadio = null;
let currentRadioIndex = -1;
let currentMode = 'tv'; // 'tv' | 'radio' | 'favoris' | 'recents'
let favorites = JSON.parse(localStorage.getItem('looktv_favorites') || '{}');
let recents = JSON.parse(localStorage.getItem('looktv_recents') || '[]');
// favorites = { 'tv': [{id,name,logo,country,categories,stream}], 'radio': [{...}] }
// recents = [{ type: 'tv' | 'radio', id: string, timestamp: number }]

// ─── FAVORITES ───
function saveFavorites() {
    localStorage.setItem('looktv_favorites', JSON.stringify(favorites));
}

function isFav(type, id) {
    return (favorites[type] || []).some(f => f.id === id);
}

// ─── RECENTS ───
function saveRecents() {
    localStorage.setItem('looktv_recents', JSON.stringify(recents));
}

function addToRecents(type, id) {
    // Retirer l_old entrée si elle existe
    recents = recents.filter(r => !(r.type === type && r.id === id));
    // Ajouter la nouvelle entrée avec un timestamp
    recents.unshift({ type, id, timestamp: Date.now() });
    // Limiter à 50 entrées
    recents = recents.slice(0, 50);
    saveRecents();
}

// Fonction pour effacer tous les récents
function clearAllRecents() {
    recents = [];
    saveRecents();
    renderRecents();
}

// Fonction pour effacer un seul récent
function removeRecent(type, id, e) {
    e.stopPropagation();
    recents = recents.filter(r => !(r.type === type && r.id === id));
    saveRecents();
    renderRecents();
}

function getRecentItem(item) {
    if (item.type === 'tv') {
        return allChannels.find(ch => ch.id === item.id);
    } else {
        return allRadios.find(r => r.id === item.id);
    }
}

function formatRecentDate(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) {
        return `Il y a ${minutes}m`;
    } else if (hours < 24) {
        return `Il y a ${hours}h`;
    } else {
        return `Il y a ${days}j`;
    }
}

function renderRecents() {
    const el = document.getElementById('channelList');
    const tvRecents = recents.filter(r => r.type === 'tv');
    const radioRecents = recents.filter(r => r.type === 'radio');
    const total = recents.length;
    document.getElementById('listCount').textContent = total;

    if (!total) {
        el.innerHTML = `<div class="recent-empty">
            <i class="fas fa-history"></i>
            <p>Aucune chaîne récente</p>
            <p style="font-size:0.8rem;color:var(--text3)">Les chaînes regardées apparaitront ici</p>
        </div>`;
        return;
    }

    let html = `<div class="recent-controls">
        <button class="btn-clear-all" onclick="clearAllRecents()" title="Effacer tout l'historique">
            <i class="fas fa-trash-alt"></i> Tout effacer
        </button>
    </div>`;
    
    if (tvRecents.length) {
        html += `<div class="recent-section-title"><i class="fas fa-tv"></i> Chaînes TV récentes (${tvRecents.length})</div>`;
        html += tvRecents.map(recent => {
            const ch = getRecentItem(recent);
            if (!ch) return '';
            
            const flag = getFlag(ch.country);
            const countryName = getCountryName(ch.country);
            const idx = allChannels.findIndex(c => c.id === ch.id);
            const isActive = currentChannel?.id === ch.id;
            const favActive = isFav('tv', ch.id) ? ' active' : '';
            
            return `<div class="channel-item${isActive ? ' active' : ''}" onclick="playChannel(${idx})" id="chi-${ch.id.replace(/[^a-z0-9]/gi, '-')}">
                ${ch.logo ? `<img class="ch-logo" src="${ch.logo}" alt="${ch.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                <div class="ch-logo-fallback" ${ch.logo ? 'style="display:none"' : ''}><i class="fas fa-tv"></i></div>
                <div class="ch-info">
                    <div class="channel-name">${ch.name}</div>
                    <div class="ch-meta">
                        ${flag ? `<span class="ch-flag">${flag}</span>` : ''}
                        ${countryName ? `<span class="ch-country">${countryName}</span>` : ''}
                    </div>
                </div>
                <div class="recent-date">${formatRecentDate(recent.timestamp)}</div>
                <button class="btn-remove-recent" onclick="removeRecent('tv', '${ch.id}', event)" title="Supprimer de l'historique">
                    <i class="fas fa-times"></i>
                </button>
                <button class="fav-btn${favActive}" onclick="toggleFav('tv', allChannels[${idx}], event)" title="Favoris">
                    <i class="fas fa-heart"></i>
                </button>
            </div>`;
        }).join('');
    }

    if (radioRecents.length) {
        html += `<div class="recent-section-title"><i class="fas fa-broadcast-tower"></i> Radios récentes (${radioRecents.length})</div>`;
        html += radioRecents.map(recent => {
            const r = getRecentItem(recent);
            if (!r) return '';
            
            const flag = getFlag(r.country);
            const countryName = getCountryName(r.country) || r.countryName;
            const idx = allRadios.findIndex(x => x.id === r.id);
            const isActive = currentRadio?.id === r.id;
            const favActive = isFav('radio', r.id) ? ' active' : '';
            
            return `<div class="channel-item${isActive ? ' active' : ''}" onclick="switchMode('radio');playRadio(${idx})" id="rdi-${r.id}">
                ${r.logo ? `<img class="ch-logo" src="${r.logo}" alt="${r.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                <div class="ch-logo-fallback radio-fallback" ${r.logo ? 'style="display:none"' : ''}><i class="fas fa-broadcast-tower"></i></div>
                <div class="ch-info">
                    <div class="channel-name">${r.name}</div>
                    <div class="ch-meta">
                        ${flag ? `<span class="ch-flag">${flag}</span>` : ''}
                        ${countryName ? `<span class="ch-country">${countryName}</span>` : ''}
                    </div>
                </div>
                <div class="recent-date">${formatRecentDate(recent.timestamp)}</div>
                <button class="btn-remove-recent" onclick="removeRecent('radio', '${r.id}', event)" title="Supprimer de l'historique">
                    <i class="fas fa-times"></i>
                </button>
                <button class="fav-btn${favActive}" onclick="toggleFav('radio', allRadios[${idx}], event)" title="Favoris">
                    <i class="fas fa-heart"></i>
                </button>
            </div>`;
        }).join('');
    }

    el.innerHTML = html;
}

function toggleFav(type, item, e) {
    e.stopPropagation();
    if (!favorites[type]) favorites[type] = [];
    const idx = favorites[type].findIndex(f => f.id === item.id);
    if (idx === -1) {
        favorites[type].push(item);
    } else {
        favorites[type].splice(idx, 1);
    }
    saveFavorites();
    
    // Rafraîchir les vues concernées
    if (currentMode === 'favoris') {
        renderFavoris();
    } else if (currentMode === 'tv') {
        renderChannels(filteredChannels);
    } else if (currentMode === 'radio') {
        renderRadios(filteredRadios);
    } else if (currentMode === 'recents') {
        renderRecents();
    }
}

function renderFavoris() {
    const el = document.getElementById('channelList');
    const tvFavs = favorites['tv'] || [];
    const radioFavs = favorites['radio'] || [];
    const total = tvFavs.length + radioFavs.length;
    document.getElementById('listCount').textContent = total;

    if (!total) {
        el.innerHTML = `<div class="loading-state">
            <i class="fas fa-heart" style="font-size:2rem;color:var(--text3)"></i>
            <p>Aucun favori pour l'instant</p>
            <p style="font-size:0.8rem;color:var(--text3)">Cliquez sur ❤ pour ajouter</p>
        </div>`;
        return;
    }

    let html = '';
    if (tvFavs.length) {
        html += `<div class="fav-section-title"><i class="fas fa-tv"></i> Chaînes TV (${tvFavs.length})</div>`;
        html += tvFavs.map(ch => {
            const flag = getFlag(ch.country);
            const countryName = getCountryName(ch.country);
            const idx = allChannels.findIndex(c => c.id === ch.id);
            const playIdx = idx !== -1 ? idx : (() => { allChannels.push(ch); return allChannels.length - 1; })();
            return `<div class="channel-item${currentChannel?.id === ch.id ? ' active' : ''}" onclick="playChannel(${playIdx})">
                ${ch.logo ? `<img class="ch-logo" src="${ch.logo}" alt="${ch.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                <div class="ch-logo-fallback" ${ch.logo ? 'style="display:none"' : ''}><i class="fas fa-tv"></i></div>
                <div class="ch-info">
                    <div class="channel-name">${ch.name}</div>
                    <div class="ch-meta">
                        ${flag ? `<span class="ch-flag">${flag}</span>` : ''}
                        ${countryName ? `<span class="ch-country">${countryName}</span>` : ''}
                    </div>
                </div>
                <button class="fav-btn active" onclick="toggleFav('tv', ${JSON.stringify(ch).replace(/"/g, '&quot;')}, event)" title="Retirer des favoris"><i class="fas fa-heart"></i></button>
            </div>`;
        }).join('');
    }

    if (radioFavs.length) {
        html += `<div class="fav-section-title"><i class="fas fa-broadcast-tower"></i> Radios (${radioFavs.length})</div>`;
        html += radioFavs.map(r => {
            const flag = getFlag(r.country);
            const countryName = getCountryName(r.country) || r.countryName;
            const idx = allRadios.findIndex(x => x.id === r.id);
            const playIdx = idx !== -1 ? idx : (() => { allRadios.push(r); return allRadios.length - 1; })();
            return `<div class="channel-item${currentRadio?.id === r.id ? ' active' : ''}" onclick="switchMode('radio');playRadio(${playIdx})">
                ${r.logo ? `<img class="ch-logo" src="${r.logo}" alt="${r.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                <div class="ch-logo-fallback radio-fallback" ${r.logo ? 'style="display:none"' : ''}><i class="fas fa-broadcast-tower"></i></div>
                <div class="ch-info">
                    <div class="channel-name">${r.name}</div>
                    <div class="ch-meta">
                        ${flag ? `<span class="ch-flag">${flag}</span>` : ''}
                        ${countryName ? `<span class="ch-country">${countryName}</span>` : ''}
                    </div>
                </div>
                <button class="fav-btn active" onclick="toggleFav('radio', ${JSON.stringify(r).replace(/"/g, '&quot;')}, event)" title="Retirer des favoris"><i class="fas fa-heart"></i></button>
            </div>`;
        }).join('');
    }

    el.innerHTML = html;
}


function parseM3U(text) {
    const lines = text.split('\n');
    const channels = [];
    let current = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXTINF')) {
            current = {};
            const nameMatch = line.match(/,(.+)$/);
            if (nameMatch) current.name = nameMatch[1].trim();
            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            if (logoMatch) current.logo = logoMatch[1];
            const countryMatch = line.match(/tvg-country="([^"]*)"/);
            if (countryMatch) current.country = countryMatch[1].toUpperCase();
            const groupMatch = line.match(/group-title="([^"]*)"/);
            if (groupMatch) current.categories = [groupMatch[1].toLowerCase()];
            const idMatch = line.match(/tvg-id="([^"]*)"/);
            if (idMatch) current.id = idMatch[1];
        } else if (line.startsWith('http') && current) {
            current.stream = { url: line };
            if (!current.id) current.id = `m3u_${Math.random().toString(36).substr(2, 9)}`;
            if (current.name) channels.push(current);
            current = null;
        }
    }
    return channels;
}

// ─── LOAD TV DATA ───
async function loadTVData() {
    const [chRes, stRes, ctRes] = await Promise.all([
        fetch(`${API}/channels.json`),
        fetch(`${API}/streams.json`),
        fetch(`${API}/countries.json`)
    ]);
    const apiChannels = await chRes.json();
    const apiStreams = await stRes.json();
    countries = await ctRes.json();

    const streamMap = {};
    apiStreams.forEach(s => {
        if (!s.channel || !s.url) return;
        const existing = streamMap[s.channel];
        if (!existing) { streamMap[s.channel] = s; return; }
        // Garder la meilleure résolution
        const rank = q => q === '1080p' ? 4 : q === '720p' ? 3 : q === '480p' ? 2 : q === '360p' ? 1 : 0;
        if (rank(s.quality) > rank(existing.quality)) streamMap[s.channel] = s;
    });

    const merged = apiChannels
        .filter(ch => streamMap[ch.id] && !ch.is_nsfw && !ch.closed)
        .map(ch => ({ id: ch.id, name: ch.name, logo: ch.logo || '', country: ch.country || '', categories: ch.categories || [], stream: streamMap[ch.id] }));

    const m3uResults = await Promise.allSettled(
        EXTRA_SOURCES.map(url => fetch(url).then(r => r.text()).then(parseM3U).catch(() => []))
    );
    const m3uChannels = m3uResults.filter(r => r.status === 'fulfilled').flatMap(r => r.value);

    const urlSeen = new Set();
    allChannels = [...merged, ...m3uChannels].filter(ch => {
        const url = ch.stream?.url;
        if (!url || urlSeen.has(url)) return false;
        urlSeen.add(url);
        return true;
    });

    filteredChannels = [...allChannels];
    populateCountries();
    document.getElementById('pStatChannels').textContent = allChannels.length.toLocaleString();
    document.getElementById('pStatCountries').textContent = '195';
    document.getElementById('channelCount').innerHTML = `<i class="fas fa-tv"></i> <span>${allChannels.length.toLocaleString()} chaînes</span>`;
    renderChannels(filteredChannels);
}

// ─── LOAD RADIO DATA ───
async function loadRadioData() {
    try {
        const res = await fetch(`${RADIO_API}/stations/search?limit=5000&hidebroken=true&order=clickcount&reverse=true`);
        const data = await res.json();
        allRadios = data.map(s => ({
            id: s.stationuuid,
            name: s.name,
            logo: s.favicon || '',
            country: s.countrycode?.toUpperCase() || '',
            countryName: s.country || '',
            tags: s.tags ? s.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            codec: s.codec,
            bitrate: s.bitrate,
            url: s.url_resolved || s.url,
            votes: s.votes
        }));
        filteredRadios = [...allRadios];
        document.getElementById('pStatRadios').textContent = allRadios.length.toLocaleString();
        document.getElementById('pStatRadios2').textContent = allRadios.length.toLocaleString();
        document.getElementById('pStatCountries2').textContent = [...new Set(allRadios.map(r => r.country).filter(Boolean))].length;
    } catch (e) {
        console.error('Radio load error:', e);
    }
}

// ─── POPULATE COUNTRIES ───
const ALL_COUNTRIES = [
    {code:'AD',name:'Andorre'},{code:'AE',name:'Émirats arabes unis'},{code:'AF',name:'Afghanistan'},
    {code:'AG',name:'Antigua-et-Barbuda'},{code:'AI',name:'Anguilla'},{code:'AL',name:'Albanie'},
    {code:'AM',name:'Arménie'},{code:'AO',name:'Angola'},{code:'AR',name:'Argentine'},
    {code:'AS',name:'Samoa américaines'},{code:'AT',name:'Autriche'},{code:'AU',name:'Australie'},
    {code:'AW',name:'Aruba'},{code:'AZ',name:'Azerbaïdjan'},{code:'BA',name:'Bosnie-Herzégovine'},
    {code:'BB',name:'Barbade'},{code:'BD',name:'Bangladesh'},{code:'BE',name:'Belgique'},
    {code:'BF',name:'Burkina Faso'},{code:'BG',name:'Bulgarie'},{code:'BH',name:'Bahreïn'},
    {code:'BI',name:'Burundi'},{code:'BJ',name:'Bénin'},{code:'BL',name:'Saint-Barthélemy'},
    {code:'BM',name:'Bermudes'},{code:'BN',name:'Brunei'},{code:'BO',name:'Bolivie'},
    {code:'BR',name:'Brésil'},{code:'BS',name:'Bahamas'},{code:'BT',name:'Bhoutan'},
    {code:'BW',name:'Botswana'},{code:'BY',name:'Biélorussie'},{code:'BZ',name:'Belize'},
    {code:'CA',name:'Canada'},{code:'CD',name:'Congo (RDC)'},{code:'CF',name:'Centrafrique'},
    {code:'CG',name:'Congo'},{code:'CH',name:'Suisse'},{code:'CI',name:'Côte d\'Ivoire'},
    {code:'CK',name:'Îles Cook'},{code:'CL',name:'Chili'},{code:'CM',name:'Cameroun'},
    {code:'CN',name:'Chine'},{code:'CO',name:'Colombie'},{code:'CR',name:'Costa Rica'},
    {code:'CU',name:'Cuba'},{code:'CV',name:'Cap-Vert'},{code:'CW',name:'Curaçao'},
    {code:'CY',name:'Chypre'},{code:'CZ',name:'Tchéquie'},{code:'DE',name:'Allemagne'},
    {code:'DJ',name:'Djibouti'},{code:'DK',name:'Danemark'},{code:'DM',name:'Dominique'},
    {code:'DO',name:'République dominicaine'},{code:'DZ',name:'Algérie'},{code:'EC',name:'Équateur'},
    {code:'EE',name:'Estonie'},{code:'EG',name:'Égypte'},{code:'EH',name:'Sahara occidental'},
    {code:'ER',name:'Érythrée'},{code:'ES',name:'Espagne'},{code:'ET',name:'Éthiopie'},
    {code:'FI',name:'Finlande'},{code:'FJ',name:'Fidji'},{code:'FK',name:'Îles Malouines'},
    {code:'FM',name:'Micronésie'},{code:'FO',name:'Îles Féroé'},{code:'FR',name:'France'},
    {code:'GA',name:'Gabon'},{code:'GB',name:'Royaume-Uni'},{code:'GD',name:'Grenade'},
    {code:'GE',name:'Géorgie'},{code:'GF',name:'Guyane française'},{code:'GH',name:'Ghana'},
    {code:'GI',name:'Gibraltar'},{code:'GL',name:'Groenland'},{code:'GM',name:'Gambie'},
    {code:'GN',name:'Guinée'},{code:'GP',name:'Guadeloupe'},{code:'GQ',name:'Guinée équatoriale'},
    {code:'GR',name:'Grèce'},{code:'GT',name:'Guatemala'},{code:'GU',name:'Guam'},
    {code:'GW',name:'Guinée-Bissau'},{code:'GY',name:'Guyana'},{code:'HK',name:'Hong Kong'},
    {code:'HN',name:'Honduras'},{code:'HR',name:'Croatie'},{code:'HT',name:'Haïti'},
    {code:'HU',name:'Hongrie'},{code:'ID',name:'Indonésie'},{code:'IE',name:'Irlande'},
    {code:'IL',name:'Israël'},{code:'IN',name:'Inde'},{code:'IQ',name:'Irak'},
    {code:'IR',name:'Iran'},{code:'IS',name:'Islande'},{code:'IT',name:'Italie'},
    {code:'JM',name:'Jamaïque'},{code:'JO',name:'Jordanie'},{code:'JP',name:'Japon'},
    {code:'KE',name:'Kenya'},{code:'KG',name:'Kirghizistan'},{code:'KH',name:'Cambodge'},
    {code:'KI',name:'Kiribati'},{code:'KM',name:'Comores'},{code:'KN',name:'Saint-Kitts-et-Nevis'},
    {code:'KP',name:'Corée du Nord'},{code:'KR',name:'Corée du Sud'},{code:'KW',name:'Koweït'},
    {code:'KY',name:'Îles Caïmans'},{code:'KZ',name:'Kazakhstan'},{code:'LA',name:'Laos'},
    {code:'LB',name:'Liban'},{code:'LC',name:'Sainte-Lucie'},{code:'LI',name:'Liechtenstein'},
    {code:'LK',name:'Sri Lanka'},{code:'LR',name:'Liberia'},{code:'LS',name:'Lesotho'},
    {code:'LT',name:'Lituanie'},{code:'LU',name:'Luxembourg'},{code:'LV',name:'Lettonie'},
    {code:'LY',name:'Libye'},{code:'MA',name:'Maroc'},{code:'MC',name:'Monaco'},
    {code:'MD',name:'Moldavie'},{code:'ME',name:'Monténégro'},{code:'MF',name:'Saint-Martin'},
    {code:'MG',name:'Madagascar'},{code:'MH',name:'Îles Marshall'},{code:'MK',name:'Macédoine du Nord'},
    {code:'ML',name:'Mali'},{code:'MM',name:'Myanmar'},{code:'MN',name:'Mongolie'},
    {code:'MO',name:'Macao'},{code:'MP',name:'Mariannes du Nord'},{code:'MQ',name:'Martinique'},
    {code:'MR',name:'Mauritanie'},{code:'MS',name:'Montserrat'},{code:'MT',name:'Malte'},
    {code:'MU',name:'Maurice'},{code:'MV',name:'Maldives'},{code:'MW',name:'Malawi'},
    {code:'MX',name:'Mexique'},{code:'MY',name:'Malaisie'},{code:'MZ',name:'Mozambique'},
    {code:'NA',name:'Namibie'},{code:'NC',name:'Nouvelle-Calédonie'},{code:'NE',name:'Niger'},
    {code:'NF',name:'Île Norfolk'},{code:'NG',name:'Nigeria'},{code:'NI',name:'Nicaragua'},
    {code:'NL',name:'Pays-Bas'},{code:'NO',name:'Norvège'},{code:'NP',name:'Népal'},
    {code:'NR',name:'Nauru'},{code:'NU',name:'Niue'},{code:'NZ',name:'Nouvelle-Zélande'},
    {code:'OM',name:'Oman'},{code:'PA',name:'Panama'},{code:'PE',name:'Pérou'},
    {code:'PF',name:'Polynésie française'},{code:'PG',name:'Papouasie-Nouvelle-Guinée'},{code:'PH',name:'Philippines'},
    {code:'PK',name:'Pakistan'},{code:'PL',name:'Pologne'},{code:'PM',name:'Saint-Pierre-et-Miquelon'},
    {code:'PR',name:'Porto Rico'},{code:'PS',name:'Palestine'},{code:'PT',name:'Portugal'},
    {code:'PW',name:'Palaos'},{code:'PY',name:'Paraguay'},{code:'QA',name:'Qatar'},
    {code:'RE',name:'La Réunion'},{code:'RO',name:'Roumanie'},{code:'RS',name:'Serbie'},
    {code:'RU',name:'Russie'},{code:'RW',name:'Rwanda'},{code:'SA',name:'Arabie saoudite'},
    {code:'SB',name:'Îles Salomon'},{code:'SC',name:'Seychelles'},{code:'SD',name:'Soudan'},
    {code:'SE',name:'Suède'},{code:'SG',name:'Singapour'},{code:'SH',name:'Sainte-Hélène'},
    {code:'SI',name:'Slovénie'},{code:'SK',name:'Slovaquie'},{code:'SL',name:'Sierra Leone'},
    {code:'SM',name:'Saint-Marin'},{code:'SN',name:'Sénégal'},{code:'SO',name:'Somalie'},
    {code:'SR',name:'Suriname'},{code:'SS',name:'Soudan du Sud'},{code:'ST',name:'Sao Tomé-et-Principe'},
    {code:'SV',name:'Salvador'},{code:'SX',name:'Saint-Martin (néerl.)'},{code:'SY',name:'Syrie'},
    {code:'SZ',name:'Eswatini'},{code:'TC',name:'Îles Turques-et-Caïques'},{code:'TD',name:'Tchad'},
    {code:'TG',name:'Togo'},{code:'TH',name:'Thaïlande'},{code:'TJ',name:'Tadjikistan'},
    {code:'TK',name:'Tokelau'},{code:'TL',name:'Timor oriental'},{code:'TM',name:'Turkménistan'},
    {code:'TN',name:'Tunisie'},{code:'TO',name:'Tonga'},{code:'TR',name:'Turquie'},
    {code:'TT',name:'Trinité-et-Tobago'},{code:'TV',name:'Tuvalu'},{code:'TW',name:'Taïwan'},
    {code:'TZ',name:'Tanzanie'},{code:'UA',name:'Ukraine'},{code:'UG',name:'Ouganda'},
    {code:'US',name:'États-Unis'},{code:'UY',name:'Uruguay'},{code:'UZ',name:'Ouzbékistan'},
    {code:'VA',name:'Vatican'},{code:'VC',name:'Saint-Vincent-et-les-Grenadines'},{code:'VE',name:'Venezuela'},
    {code:'VG',name:'Îles Vierges britanniques'},{code:'VI',name:'Îles Vierges américaines'},{code:'VN',name:'Vietnam'},
    {code:'VU',name:'Vanuatu'},{code:'WF',name:'Wallis-et-Futuna'},{code:'WS',name:'Samoa'},
    {code:'YE',name:'Yémen'},{code:'YT',name:'Mayotte'},{code:'ZA',name:'Afrique du Sud'},
    {code:'ZM',name:'Zambie'},{code:'ZW',name:'Zimbabwe'}
].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

function populateCountries() {
    const sel = document.getElementById('countrySelect');
    sel.innerHTML = '<option value="">Tous les pays</option>';
    ALL_COUNTRIES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = c.name;
        sel.appendChild(opt);
    });
}

function populateRadioCountries() {
    populateCountries();
}

// ─── SWITCH MODE ───
function switchMode(mode) {
    currentMode = mode;
    document.getElementById('tabTV').classList.toggle('active', mode === 'tv');
    document.getElementById('tabRadio').classList.toggle('active', mode === 'radio');
    document.getElementById('tabRecent').classList.toggle('active', mode === 'recents');
    document.getElementById('tabFav').classList.toggle('active', mode === 'favoris');
    document.getElementById('tvPlayer').style.display = mode === 'tv' || mode === 'favoris' || mode === 'recents' ? 'flex' : 'none';
    document.getElementById('radioPlayer').style.display = mode === 'radio' ? 'flex' : 'none';
    document.getElementById('nowPlayingBar').style.display = mode === 'tv' && currentChannel ? 'flex' : 'none';
    document.getElementById('categoryGroup').style.display = mode === 'tv' ? 'block' : 'none';
    document.getElementById('genreGroup').style.display = mode === 'radio' ? 'block' : 'none';
    document.getElementById('filterSection') && (document.getElementById('filterSection').style.display = mode === 'favoris' || mode === 'recents' ? 'none' : '');

    document.querySelector('.filter-section').style.display = mode === 'favoris' || mode === 'recents' ? 'none' : '';

    if (mode === 'favoris') {
        document.getElementById('listTitle').textContent = 'Mes Favoris';
        renderFavoris();
        return;
    }
    
    if (mode === 'recents') {
        document.getElementById('listTitle').textContent = 'Chaînes récentes';
        renderRecents();
        return;
    }

    // Reset filters
    document.getElementById('countrySelect').value = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').style.display = 'none';

    if (mode === 'tv') {
        populateCountries();
        filteredChannels = [...allChannels];
        document.getElementById('listTitle').textContent = 'Toutes les chaînes';
        renderChannels(filteredChannels);
    } else {
        populateCountries();
        filteredRadios = [...allRadios];
        document.getElementById('listTitle').textContent = 'Toutes les stations';
        renderRadios(filteredRadios);
    }
}

// ─── RENDER TV CHANNELS ───
function renderChannels(list) {
    const el = document.getElementById('channelList');
    document.getElementById('listCount').textContent = list.length.toLocaleString();
    if (!list.length) {
        el.innerHTML = `<div class="loading-state"><i class="fas fa-search" style="font-size:2rem;color:var(--text3)"></i><p>Aucune chaîne trouvée</p></div>`;
        return;
    }
    const MAX = 500;
    el.innerHTML = list.slice(0, MAX).map(ch => {
        const flag = getFlag(ch.country);
        const countryName = getCountryName(ch.country);
        const cat = ch.categories?.[0] || '';
        const quality = ch.stream?.quality || '';
        const isActive = currentChannel?.id === ch.id;
        const idx = allChannels.indexOf(ch);
        const favActive = isFav('tv', ch.id) ? ' active' : '';
        return `<div class="channel-item${isActive ? ' active' : ''}" onclick="playChannel(${idx})" id="chi-${ch.id.replace(/[^a-z0-9]/gi, '-')}">
            ${ch.logo ? `<img class="ch-logo" src="${ch.logo}" alt="${ch.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
            <div class="ch-logo-fallback" ${ch.logo ? 'style="display:none"' : ''}><i class="fas fa-tv"></i></div>
            <div class="ch-info">
                <div class="channel-name">${ch.name}</div>
                <div class="ch-meta">
                    ${flag ? `<span class="ch-flag">${flag}</span>` : ''}
                    ${countryName ? `<span class="ch-country">${countryName}</span>` : ''}
                    ${quality ? `<span class="ch-quality">${quality}</span>` : ''}
                    ${cat ? `<span class="ch-cat">${cat}</span>` : ''}
                </div>
            </div>
            <button class="fav-btn${favActive}" onclick="toggleFav('tv', allChannels[${idx}], event)" title="Favoris"><i class="fas fa-heart"></i></button>
        </div>`;
    }).join('');
    if (list.length > MAX) {
        el.innerHTML += `<div class="loading-state" style="padding:1rem"><p style="color:var(--text3);font-size:0.8rem">+ ${(list.length - MAX).toLocaleString()} autres — affinez la recherche</p></div>`;
    }
}

// ─── RENDER RADIOS ───
function renderRadios(list) {
    const el = document.getElementById('channelList');
    document.getElementById('listCount').textContent = list.length.toLocaleString();
    if (!list.length) {
        el.innerHTML = `<div class="loading-state"><i class="fas fa-search" style="font-size:2rem;color:var(--text3)"></i><p>Aucune station trouvée</p></div>`;
        return;
    }
    const MAX = 500;
    el.innerHTML = list.slice(0, MAX).map(r => {
        const flag = getFlag(r.country);
        const countryName = getCountryName(r.country) || r.countryName;
        const isActive = currentRadio?.id === r.id;
        const idx = allRadios.indexOf(r);
        const tag = r.tags?.[0] || '';
        const favActive = isFav('radio', r.id) ? ' active' : '';
        return `<div class="channel-item${isActive ? ' active' : ''}" onclick="playRadio(${idx})" id="rdi-${r.id}">
            ${r.logo ? `<img class="ch-logo" src="${r.logo}" alt="${r.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
            <div class="ch-logo-fallback radio-fallback" ${r.logo ? 'style="display:none"' : ''}><i class="fas fa-broadcast-tower"></i></div>
            <div class="ch-info">
                <div class="channel-name">${r.name}</div>
                <div class="ch-meta">
                    ${flag ? `<span class="ch-flag">${flag}</span>` : ''}
                    ${countryName ? `<span class="ch-country">${countryName}</span>` : ''}
                    ${r.bitrate ? `<span class="ch-quality">${r.bitrate}kbps</span>` : ''}
                    ${tag ? `<span class="ch-cat">${tag}</span>` : ''}
                </div>
            </div>
            <button class="fav-btn${favActive}" onclick="toggleFav('radio', allRadios[${idx}], event)" title="Favoris"><i class="fas fa-heart"></i></button>
        </div>`;
    }).join('');
    if (list.length > MAX) {
        el.innerHTML += `<div class="loading-state" style="padding:1rem"><p style="color:var(--text3);font-size:0.8rem">+ ${(list.length - MAX).toLocaleString()} autres — affinez la recherche</p></div>`;
    }
}

// ─── PLAY TV CHANNEL ───
function playChannel(index) {
    const ch = allChannels[index];
    if (!ch) return;
    currentChannel = ch;
    currentIndex = index;

    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`chi-${ch.id.replace(/[^a-z0-9]/gi, '-')}`);
    if (el) { el.classList.add('active'); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

    document.getElementById('placeholder').style.display = 'none';
    document.getElementById('screenError').style.display = 'none';
    document.getElementById('screenLoading').style.display = 'flex';

    const bar = document.getElementById('nowPlayingBar');
    bar.style.display = 'flex';
    document.getElementById('npName').textContent = ch.name;
    document.getElementById('npMeta').textContent = [getCountryName(ch.country), ch.categories?.[0]].filter(Boolean).join(' · ');

    const img = document.getElementById('npLogo');
    const fallback = document.getElementById('npFallback');
    if (ch.logo) { img.src = ch.logo; img.style.display = 'block'; fallback.style.display = 'none'; }
    else { img.style.display = 'none'; fallback.style.display = 'flex'; }

    // Ajouter à l'historique des récents
    addToRecents('tv', ch.id);
    if (currentMode === 'recents') {
        renderRecents();
    }

    loadStream(ch.stream.url);
}

// ─── PLAY RADIO ───
function playRadio(index) {
    const r = allRadios[index];
    if (!r) return;
    currentRadio = r;
    currentRadioIndex = index;

    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`rdi-${r.id}`);
    if (el) { el.classList.add('active'); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

    // Show now playing
    document.getElementById('radioPlaceholder').style.display = 'none';
    document.getElementById('radioNowPlaying').style.display = 'flex';
    document.getElementById('radioStationName').textContent = r.name;
    document.getElementById('radioStationMeta').textContent = [getCountryName(r.country) || r.countryName, r.codec, r.bitrate ? `${r.bitrate}kbps` : ''].filter(Boolean).join(' · ');
    document.getElementById('radioCtrlName').textContent = r.name;

    // Tags
    const tagsEl = document.getElementById('radioTags');
    tagsEl.innerHTML = r.tags.slice(0, 4).map(t => `<span class="radio-tag">${t}</span>`).join('');

    // Logo
    const logoImg = document.getElementById('radioLogo');
    const logoFallback = document.getElementById('radioLogoFallback');
    if (r.logo) { logoImg.src = r.logo; logoImg.style.display = 'block'; logoFallback.style.display = 'none'; }
    else { logoImg.style.display = 'none'; logoFallback.style.display = 'flex'; }

    // Ajouter à l'historique des récents
    addToRecents('radio', r.id);
    if (currentMode === 'recents') {
        renderRecents();
    }

    // Play audio
    const audio = document.getElementById('audioPlayer');
    audio.src = r.url;
    audio.play().catch(() => {});
    document.getElementById('radioPlayBtn').innerHTML = '<i class="fas fa-pause"></i>';
    document.getElementById('radioBars').classList.add('playing');
}

function toggleRadioPlay() {
    const audio = document.getElementById('audioPlayer');
    const btn = document.getElementById('radioPlayBtn');
    const bars = document.getElementById('radioBars');
    if (audio.paused) {
        audio.play();
        btn.innerHTML = '<i class="fas fa-pause"></i>';
        bars.classList.add('playing');
    } else {
        audio.pause();
        btn.innerHTML = '<i class="fas fa-play"></i>';
        bars.classList.remove('playing');
    }
}

function prevRadio() {
    if (currentRadioIndex > 0) playRadio(currentRadioIndex - 1);
}
function nextRadio() {
    if (currentRadioIndex < allRadios.length - 1) playRadio(currentRadioIndex + 1);
}

// Volume
document.getElementById('volumeSlider').addEventListener('input', (e) => {
    document.getElementById('audioPlayer').volume = e.target.value;
});

// ─── LOAD HLS STREAM ───
function loadStream(url) {
    const video = document.getElementById('videoPlayer');
    if (currentHls) { currentHls.destroy(); currentHls = null; }
    if (Hls.isSupported()) {
        currentHls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            maxBufferSize: 60 * 1000 * 1000,
            abrEwmaDefaultEstimate: 5000000,
            startLevel: -1, // auto = meilleure qualité disponible
            capLevelToPlayerSize: false,
            autoStartLoad: true,
        });
        currentHls.loadSource(url);
        currentHls.attachMedia(video);
        currentHls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
            // Sélectionner automatiquement le niveau de qualité le plus élevé
            const levels = data.levels;
            if (levels && levels.length > 0) {
                const bestLevel = levels.reduce((best, lvl, idx) =>
                    lvl.height > (levels[best]?.height || 0) ? idx : best, 0);
                currentHls.currentLevel = bestLevel;
            }
            document.getElementById('screenLoading').style.display = 'none';
            video.play().catch(() => {});
        });
        currentHls.on(Hls.Events.ERROR, (e, data) => { if (data.fatal) showError(); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => { document.getElementById('screenLoading').style.display = 'none'; video.play().catch(() => {}); }, { once: true });
        video.addEventListener('error', showError, { once: true });
    } else { showError(); }
}

function showError() {
    document.getElementById('screenLoading').style.display = 'none';
    document.getElementById('screenError').style.display = 'flex';
}
function retryChannel() {
    if (currentChannel) { document.getElementById('screenError').style.display = 'none'; document.getElementById('screenLoading').style.display = 'flex'; loadStream(currentChannel.stream.url); }
}
function nextChannel() {
    if (currentIndex < allChannels.length - 1) playChannel(currentIndex + 1);
}

// ─── CONTROLS ───
function toggleFullscreen() {
    const screen = document.getElementById('tvScreen');
    if (!document.fullscreenElement) screen.requestFullscreen();
    else document.exitFullscreen();
}
function toggleMute() {
    const video = document.getElementById('videoPlayer');
    const btn = document.getElementById('muteBtn');
    video.muted = !video.muted;
    btn.innerHTML = video.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
}
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('hidden');
}

// Fonction pour basculer l'affichage des textes des onglets
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('sidebarDividerIcon');
    const layout = document.querySelector('.app-layout');

    sidebar.classList.toggle('compact');
    const isCompact = sidebar.classList.contains('compact');
    icon.style.transform = isCompact ? 'rotate(180deg)' : '';
    layout.classList.toggle('sidebar-compact', isCompact);
}

function toggleSidebarWidth() { toggleSidebar(); }

// ─── FILTERS ───
function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const country = document.getElementById('countrySelect').value;

    if (currentMode === 'tv') {
        const category = document.getElementById('categorySelect').value;
        filteredChannels = allChannels.filter(ch => {
            if (country && ch.country !== country) return false;
            if (category && !ch.categories?.includes(category)) return false;
            if (search && !ch.name.toLowerCase().includes(search) && !getCountryName(ch.country).toLowerCase().includes(search)) return false;
            return true;
        });
        document.getElementById('listTitle').textContent = filteredChannels.length < allChannels.length ? 'Résultats filtrés' : 'Toutes les chaînes';
        renderChannels(filteredChannels);
    } else {
        const genre = document.getElementById('genreSelect').value;
        filteredRadios = allRadios.filter(r => {
            if (country && r.country !== country) return false;
            if (genre && !r.tags.some(t => t.toLowerCase().includes(genre))) return false;
            if (search && !r.name.toLowerCase().includes(search) && !(getCountryName(r.country) || r.countryName).toLowerCase().includes(search)) return false;
            return true;
        });
        document.getElementById('listTitle').textContent = filteredRadios.length < allRadios.length ? 'Résultats filtrés' : 'Toutes les stations';
        renderRadios(filteredRadios);
    }
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    document.getElementById('searchClear').style.display = e.target.value ? 'block' : 'none';
    applyFilters();
});
document.getElementById('searchClear').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').style.display = 'none';
    applyFilters();
});
document.getElementById('countrySelect').addEventListener('change', applyFilters);
document.getElementById('categorySelect').addEventListener('change', applyFilters);
document.getElementById('genreSelect').addEventListener('change', applyFilters);

// ─── HELPERS ───
function getFlag(code) {
    if (!code) return '';
    const c = countries.find(c => c.code === code);
    return c?.flag || '';
}
function getCountryName(code) {
    if (!code) return '';
    const c = countries.find(c => c.code === code);
    return c?.name || code;
}

// ─── INIT ───
async function init() {
    await Promise.all([loadTVData(), loadRadioData()]);
}
init();