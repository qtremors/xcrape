/* ═══════════════════════════════════════════════════════════════════════════
   XCRAPE — Material TUI Frontend Logic v2
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('scrapeForm');
    const submitBtn = document.getElementById('submitBtn');
    const jobsTableBody = document.querySelector('#jobsTable tbody');
    const detailPanel = document.getElementById('detailPanel');
    const tabBar = document.getElementById('tabBar');
    const tabContent = document.getElementById('tabContent');
    const footerStatus = document.getElementById('footerStatus');
    const footerJobCount = document.getElementById('footerJobCount');
    const refreshIndicator = document.getElementById('refreshIndicator');
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const rescrapeBtn = document.getElementById('rescrapeBtn');
    const copyBtn = document.getElementById('copyBtn');
    const detailJobIdEl = document.getElementById('detailJobId');
    const searchInput = document.getElementById('searchInput');

    let currentDetailJobId = null;
    let currentDetailData = null;
    let allJobs = [];

    // ── Init ──────────────────────────────────────────────────────────────
    fetchJobs();
    setInterval(fetchJobs, 4000);

    // ── Search/Filter ─────────────────────────────────────────────────────
    searchInput.addEventListener('input', () => {
        renderJobs(filterJobs(allJobs));
    });

    function filterJobs(jobs) {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) return jobs;
        return jobs.filter(j =>
            j.url.toLowerCase().includes(q) ||
            j.status.toLowerCase().includes(q)
        );
    }

    // ── Form Submit ───────────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('url').value.trim();
        const selector = document.getElementById('selector').value.trim();
        if (!url) return;

        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = 'SENDING...';

        try {
            const resp = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, selector: selector || null }),
            });
            if (resp.ok) {
                const data = await resp.json();
                toast(`Job #${data.job_id} created`, 'success');
                document.getElementById('url').value = '';
                document.getElementById('selector').value = '';
                fetchJobs();
            } else {
                toast('Failed to create job', 'error');
            }
        } catch (err) {
            console.error('Scrape error:', err);
            toast('Network error', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').textContent = 'EXECUTE';
        }
    });

    // ── Fetch Jobs ────────────────────────────────────────────────────────
    async function fetchJobs() {
        refreshIndicator.classList.add('active');
        try {
            const resp = await fetch('/api/jobs');
            const data = await resp.json();
            allJobs = data.jobs;
            renderJobs(filterJobs(allJobs));
            footerJobCount.textContent = allJobs.length;

            const running = allJobs.filter(j => j.status === 'running').length;
            const pending = allJobs.filter(j => j.status === 'pending').length;
            if (running > 0) {
                footerStatus.textContent = `RUNNING (${running})`;
                footerStatus.style.color = 'var(--status-running)';
            } else if (pending > 0) {
                footerStatus.textContent = `PENDING (${pending})`;
                footerStatus.style.color = 'var(--status-pending)';
            } else {
                footerStatus.textContent = 'IDLE';
                footerStatus.style.color = 'var(--md-primary)';
            }
        } catch (err) {
            console.error('Fetch jobs error:', err);
        } finally {
            setTimeout(() => refreshIndicator.classList.remove('active'), 500);
        }
    }

    // ── Render Jobs Table ─────────────────────────────────────────────────
    function renderJobs(jobs) {
        if (!jobs || jobs.length === 0) {
            jobsTableBody.innerHTML = `
                <tr><td colspan="5" class="empty-state">
                    <span class="material-symbols-outlined">inbox</span>
                    <span>${searchInput.value ? 'No matching jobs' : 'No jobs in queue. Start a scrape above.'}</span>
                </td></tr>`;
            return;
        }

        jobsTableBody.innerHTML = '';
        jobs.forEach(job => {
            const tr = document.createElement('tr');
            const hasData = job.status === 'completed' || (job.status === 'failed' && job.data);
            if (hasData) tr.classList.add('clickable');

            const timeStr = job.created_at ? formatTime(job.created_at) : '—';

            tr.innerHTML = `
                <td style="color: var(--md-on-surface-variant); font-weight: 600;">#${job.id}</td>
                <td class="url-cell"><a href="${escapeHtml(job.url)}" target="_blank" title="${escapeHtml(job.url)}">${truncateUrl(job.url)}</a></td>
                <td><span class="status-badge ${job.status}"><span class="status-dot"></span>${job.status}</span></td>
                <td class="time-cell">${timeStr}</td>
                <td class="actions-cell">
                    ${hasData ? `<button class="action-btn view-btn" data-id="${job.id}" title="View Data"><span class="material-symbols-outlined">visibility</span></button>` : ''}
                    <button class="action-btn rescrape-btn" data-id="${job.id}" title="Re-scrape"><span class="material-symbols-outlined">refresh</span></button>
                    <button class="action-btn delete delete-btn" data-id="${job.id}" title="Delete"><span class="material-symbols-outlined">delete</span></button>
                </td>
            `;
            jobsTableBody.appendChild(tr);
        });

        // View buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDetail(parseInt(btn.dataset.id));
            });
        });

        // Row click
        document.querySelectorAll('#jobsTable tbody tr.clickable').forEach(row => {
            row.addEventListener('click', () => {
                const viewBtn = row.querySelector('.view-btn');
                if (viewBtn) viewBtn.click();
            });
        });

        // Re-scrape buttons (in table)
        document.querySelectorAll('.rescrape-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await doRescrape(parseInt(btn.dataset.id));
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                try {
                    const resp = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
                    if (resp.ok) {
                        toast(`Job #${id} deleted`, 'info');
                        if (currentDetailJobId === parseInt(id)) closeDetail();
                        fetchJobs();
                    } else {
                        toast('Failed to delete job', 'error');
                    }
                } catch (err) {
                    toast('Network error', 'error');
                }
            });
        });
    }

    // ── Re-scrape ─────────────────────────────────────────────────────────
    async function doRescrape(jobId) {
        try {
            const resp = await fetch(`/api/jobs/${jobId}/rescrape`, { method: 'POST' });
            if (resp.ok) {
                const data = await resp.json();
                toast(`Re-scrape started as Job #${data.job_id}`, 'success');
                fetchJobs();
            } else {
                toast('Failed to re-scrape', 'error');
            }
        } catch (err) {
            toast('Network error', 'error');
        }
    }

    rescrapeBtn.addEventListener('click', () => {
        if (currentDetailJobId) doRescrape(currentDetailJobId);
    });

    // ── Copy to Clipboard ─────────────────────────────────────────────────
    copyBtn.addEventListener('click', async () => {
        if (!currentDetailData) return;
        try {
            // Strip screenshot from copy (too large)
            const copyData = { ...currentDetailData };
            delete copyData.screenshot;
            await navigator.clipboard.writeText(JSON.stringify(copyData, null, 2));
            toast('Copied to clipboard', 'success');
        } catch (err) {
            toast('Failed to copy', 'error');
        }
    });

    // ── Detail Panel ──────────────────────────────────────────────────────
    async function openDetail(jobId) {
        try {
            const resp = await fetch(`/api/jobs/${jobId}`);
            if (!resp.ok) { toast('Failed to load job data', 'error'); return; }
            const result = await resp.json();
            const job = result.job;

            if (!job.data) { toast('No data available yet', 'info'); return; }

            let parsedData;
            try { parsedData = JSON.parse(job.data); }
            catch { toast('Invalid job data', 'error'); return; }

            currentDetailJobId = jobId;
            currentDetailData = parsedData;
            detailJobIdEl.textContent = `#${jobId}`;
            detailPanel.style.display = '';

            if (parsedData.error) {
                showErrorDetail(parsedData);
                return;
            }

            // Activate first tab
            const tabs = tabBar.querySelectorAll('.tab');
            tabs.forEach(t => t.classList.remove('active'));
            tabs[0].classList.add('active');
            renderTab('screenshot');

            detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            toast('Network error', 'error');
        }
    }

    function closeDetail() {
        detailPanel.style.display = 'none';
        currentDetailJobId = null;
        currentDetailData = null;
        tabContent.innerHTML = '';
    }

    closeDetailBtn.addEventListener('click', closeDetail);

    // ── Tabs ──────────────────────────────────────────────────────────────
    tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderTab(tab.dataset.tab);
    });

    function renderTab(name) {
        if (!currentDetailData) return;
        const d = currentDetailData;
        switch (name) {
            case 'screenshot': renderScreenshot(d.screenshot); break;
            case 'meta': renderMeta(d.meta || {}); break;
            case 'headings': renderHeadings(d.headings || []); break;
            case 'links': renderLinks(d.links || []); break;
            case 'images': renderImages(d.images || []); break;
            case 'text': renderText(d.text || []); break;
            case 'tables': renderTables(d.tables || []); break;
            case 'tech': renderTech(d.technologies || []); break;
            case 'social': renderSocial(d.social_links || []); break;
            case 'structured': renderStructured(d.structured_data || []); break;
            case 'stats': renderStats(d.stats || {}); break;
            case 'raw': renderRaw(d); break;
        }
    }

    // ── Tab Renderers ─────────────────────────────────────────────────────

    function renderScreenshot(b64) {
        if (!b64) {
            tabContent.innerHTML = emptySection('No screenshot captured');
            return;
        }
        tabContent.innerHTML = `
            <div style="text-align: center; padding: 0.5rem;">
                <img src="data:image/jpeg;base64,${b64}"
                     alt="Page Screenshot"
                     style="max-width: 100%; border-radius: 12px; border: 1px solid var(--md-outline-variant); box-shadow: var(--elevation-2);">
            </div>`;
    }

    function renderMeta(meta) {
        const fields = [
            { label: 'Title', value: meta.title },
            { label: 'Description', value: meta.description },
            { label: 'Keywords', value: meta.keywords },
            { label: 'OG Title', value: meta.og_title },
            { label: 'OG Description', value: meta.og_description },
            { label: 'OG Image', value: meta.og_image },
            { label: 'Canonical URL', value: meta.canonical },
            { label: 'Favicon', value: meta.favicon },
            { label: 'Final URL', value: meta.final_url },
        ];

        let html = `${copyBtnHtml('meta')}<div class="meta-grid">`;
        fields.forEach(f => {
            const val = f.value || '';
            html += `<div class="meta-item">
                <div class="meta-label">${f.label}</div>
                <div class="meta-value ${!val ? 'empty' : ''}">${val ? escapeHtml(val) : '—'}</div>
            </div>`;
        });

        const sr = currentDetailData.selector_results;
        if (sr && sr.length > 0) {
            html += `</div><div class="section-count" style="margin-top: 1rem;">CSS Selector Results: <span>${sr.length}</span> matches</div><ul class="data-list">`;
            sr.forEach(item => {
                html += `<li><span class="heading-level">&lt;${item.tag}&gt;</span><span>${escapeHtml(item.text)}</span></li>`;
            });
            html += '</ul>';
        } else {
            html += '</div>';
        }
        tabContent.innerHTML = html;
        bindCopySection();
    }

    function renderHeadings(headings) {
        if (headings.length === 0) { tabContent.innerHTML = emptySection('No headings found'); return; }
        let html = `${copyBtnHtml('headings')}<div class="section-count">Found <span>${headings.length}</span> headings</div><ul class="data-list">`;
        headings.forEach(h => {
            const indent = (h.level - 1) * 12;
            html += `<li style="padding-left: ${indent + 12}px;"><span class="heading-level">H${h.level}</span><span>${escapeHtml(h.text)}</span></li>`;
        });
        html += '</ul>';
        tabContent.innerHTML = html;
        bindCopySection();
    }

    function renderLinks(links) {
        if (links.length === 0) { tabContent.innerHTML = emptySection('No links found'); return; }
        const internal = links.filter(l => l.internal).length;
        const external = links.length - internal;
        let html = `${copyBtnHtml('links')}<div class="section-count">Found <span>${links.length}</span> links (${internal} internal, ${external} external)</div><ul class="data-list">`;
        links.forEach(l => {
            html += `<li>
                <span class="link-badge ${l.internal ? 'internal' : 'external'}">${l.internal ? 'INT' : 'EXT'}</span>
                <div style="flex:1; min-width:0;">
                    <div class="link-text">${escapeHtml(l.text)}</div>
                    <div class="link-url"><a href="${escapeHtml(l.url)}" target="_blank">${escapeHtml(l.url)}</a></div>
                </div>
            </li>`;
        });
        html += '</ul>';
        tabContent.innerHTML = html;
        bindCopySection();
    }

    function renderImages(images) {
        if (images.length === 0) { tabContent.innerHTML = emptySection('No images found'); return; }
        let html = `${copyBtnHtml('images')}
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                <div class="section-count" style="margin-bottom: 0;">Found <span>${images.length}</span> images</div>
                <button class="tui-btn small" id="downloadAllImagesBtn">
                    <span class="material-symbols-outlined">download</span> DOWNLOAD ALL
                </button>
            </div>
            <div class="image-grid">`;
        images.forEach((img, idx) => {
            const dims = (img.width || img.height) ? `${img.width || '?'} × ${img.height || '?'}` : '';
            html += `<div class="image-card">
                <div class="image-thumb"><img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" loading="lazy" onerror="this.style.display='none'"></div>
                <div class="image-src">${escapeHtml(img.src)}</div>
                ${img.alt ? `<div class="image-alt">"${escapeHtml(img.alt)}"</div>` : ''}
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem;">
                    ${dims ? `<div class="image-dims" style="margin: 0;">${dims}</div>` : '<span></span>'}
                    <button class="action-btn download-img-btn" data-index="${idx}" title="Download image">
                        <span class="material-symbols-outlined">download</span>
                    </button>
                </div>
            </div>`;
        });
        html += '</div>';
        tabContent.innerHTML = html;
        bindCopySection();

        // Bind individual download buttons
        document.querySelectorAll('.download-img-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.index;
                window.open(`/api/jobs/${currentDetailJobId}/images/${idx}`, '_blank');
            });
        });

        // Bind download-all button
        const dlAllBtn = document.getElementById('downloadAllImagesBtn');
        if (dlAllBtn) {
            dlAllBtn.addEventListener('click', () => {
                window.open(`/api/jobs/${currentDetailJobId}/images/download-all`, '_blank');
                toast('Downloading all images as ZIP...', 'info');
            });
        }
    }

    function renderText(text) {
        if (text.length === 0) { tabContent.innerHTML = emptySection('No text content extracted'); return; }
        let html = `${copyBtnHtml('text')}<div class="section-count">Extracted <span>${text.length}</span> paragraphs</div>`;
        text.forEach(p => { html += `<div class="text-block">${escapeHtml(p)}</div>`; });
        tabContent.innerHTML = html;
        bindCopySection();
    }

    function renderTables(tables) {
        if (tables.length === 0) { tabContent.innerHTML = emptySection('No tables found'); return; }
        let html = `${copyBtnHtml('tables')}<div class="section-count">Found <span>${tables.length}</span> tables</div>`;
        tables.forEach((table, idx) => {
            html += `<div style="margin-bottom: 0.5rem; color: var(--md-on-surface-variant); font-size: 0.72rem;">TABLE ${idx + 1} (${table.length} rows)</div>`;
            html += '<div class="table-wrap"><table class="scraped-table">';
            table.forEach((row, ri) => {
                const tag = ri === 0 ? 'th' : 'td';
                html += '<tr>' + row.map(cell => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('') + '</tr>';
            });
            html += '</table></div>';
        });
        tabContent.innerHTML = html;
        bindCopySection();
    }

    function renderTech(technologies) {
        if (technologies.length === 0) { tabContent.innerHTML = emptySection('No technologies detected'); return; }
        let html = `${copyBtnHtml('tech')}<div class="section-count">Detected <span>${technologies.length}</span> technologies</div><div class="meta-grid">`;
        technologies.forEach(t => {
            html += `<div class="meta-item">
                <div class="meta-label">${escapeHtml(t.source)}</div>
                <div class="meta-value" style="font-size: 1rem; font-weight: 600;">${escapeHtml(t.name)}</div>
            </div>`;
        });
        html += '</div>';
        tabContent.innerHTML = html;
        bindCopySection();
    }

    function renderSocial(socialLinks) {
        if (socialLinks.length === 0) { tabContent.innerHTML = emptySection('No social media links found'); return; }
        let html = `${copyBtnHtml('social')}<div class="section-count">Found <span>${socialLinks.length}</span> social profiles</div><ul class="data-list">`;
        socialLinks.forEach(s => {
            html += `<li>
                <span class="link-badge external" style="min-width: 70px; text-align: center;">${escapeHtml(s.platform)}</span>
                <div style="flex:1; min-width:0;">
                    <div class="link-text">${escapeHtml(s.text || s.platform)}</div>
                    <div class="link-url"><a href="${escapeHtml(s.url)}" target="_blank">${escapeHtml(s.url)}</a></div>
                </div>
            </li>`;
        });
        html += '</ul>';
        tabContent.innerHTML = html;
        bindCopySection();
    }

    function renderStructured(structuredData) {
        if (structuredData.length === 0) { tabContent.innerHTML = emptySection('No structured data found'); return; }
        let html = `${copyBtnHtml('structured')}<div class="section-count">Found <span>${structuredData.length}</span> structured data blocks</div>`;
        structuredData.forEach((sd, idx) => {
            html += `<div style="margin-bottom: 0.5rem; font-size: 0.72rem; color: var(--md-on-surface-variant);">
                <span class="link-badge ${sd.format === 'JSON-LD' ? 'internal' : 'external'}">${escapeHtml(sd.format)}</span>
            </div>`;
            html += `<pre class="raw-json" style="margin-bottom: 1rem; max-height: 250px;">${escapeHtml(JSON.stringify(sd.data, null, 2))}</pre>`;
        });
        tabContent.innerHTML = html;
        bindCopySection();
    }

    function renderStats(stats) {
        const items = [
            { label: 'Words', value: stats.word_count },
            { label: 'Links', value: stats.link_count },
            { label: 'Internal Links', value: stats.internal_links },
            { label: 'External Links', value: stats.external_links },
            { label: 'Images', value: stats.image_count },
            { label: 'Headings', value: stats.heading_count },
            { label: 'Tables', value: stats.table_count },
            { label: 'Lists', value: stats.list_count },
            { label: 'Scripts', value: stats.script_count },
            { label: 'Inline Scripts', value: stats.inline_script_count },
            { label: 'Stylesheets', value: stats.style_count },
            { label: 'Technologies', value: stats.tech_count },
            { label: 'Social Links', value: stats.social_count },
            { label: 'Structured Data', value: stats.structured_data_count },
            { label: 'HTML Size', value: stats.html_size_bytes ? formatBytes(stats.html_size_bytes) : '—' },
            { label: 'Load Time', value: stats.load_time_seconds ? `${stats.load_time_seconds}s` : '—' },
        ];

        let html = '<div class="stats-grid">';
        items.forEach(s => {
            html += `<div class="stat-card">
                <div class="stat-value">${s.value ?? '—'}</div>
                <div class="stat-label">${s.label}</div>
            </div>`;
        });
        html += '</div>';
        tabContent.innerHTML = html;
    }

    function renderRaw(data) {
        const copyData = { ...data };
        delete copyData.screenshot; // Too large to display
        tabContent.innerHTML = `${copyBtnHtml('raw')}<pre class="raw-json">${escapeHtml(JSON.stringify(copyData, null, 2))}</pre>`;
        bindCopySection();
    }

    function showErrorDetail(data) {
        tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tabContent.innerHTML = `
            <div class="error-display">
                <div class="error-type">${escapeHtml(data.error_type || 'Error')}</div>
                <div class="error-message">${escapeHtml(data.error || 'Unknown error')}</div>
                ${data.load_time_seconds ? `<div style="margin-top: 0.5rem; color: var(--md-on-surface-variant); font-size: 0.78rem;">Failed after ${data.load_time_seconds}s</div>` : ''}
            </div>`;
    }

    // ── Per-section Copy Button ───────────────────────────────────────────
    function copyBtnHtml(section) {
        return `<button class="section-copy-btn" data-section="${section}" title="Copy this section">
            <span class="material-symbols-outlined" style="font-size: 14px;">content_copy</span> Copy
        </button>`;
    }

    function bindCopySection() {
        document.querySelectorAll('.section-copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const section = btn.dataset.section;
                const d = currentDetailData;
                let copyText = '';
                try {
                    switch (section) {
                        case 'meta': copyText = JSON.stringify(d.meta, null, 2); break;
                        case 'headings': copyText = JSON.stringify(d.headings, null, 2); break;
                        case 'links': copyText = JSON.stringify(d.links, null, 2); break;
                        case 'images': copyText = JSON.stringify(d.images, null, 2); break;
                        case 'text': copyText = (d.text || []).join('\n\n'); break;
                        case 'tables': copyText = JSON.stringify(d.tables, null, 2); break;
                        case 'tech': copyText = JSON.stringify(d.technologies, null, 2); break;
                        case 'social': copyText = JSON.stringify(d.social_links, null, 2); break;
                        case 'structured': copyText = JSON.stringify(d.structured_data, null, 2); break;
                        case 'raw': {
                            const c = { ...d }; delete c.screenshot;
                            copyText = JSON.stringify(c, null, 2); break;
                        }
                    }
                    await navigator.clipboard.writeText(copyText);
                    toast('Copied!', 'success');
                } catch { toast('Failed to copy', 'error'); }
            });
        });
    }

    // ── Export ─────────────────────────────────────────────────────────────
    exportJsonBtn.addEventListener('click', () => {
        if (!currentDetailJobId) return;
        window.open(`/api/jobs/${currentDetailJobId}/export?format=json`, '_blank');
        toast('JSON export started', 'info');
    });

    exportCsvBtn.addEventListener('click', () => {
        if (!currentDetailJobId) return;
        window.open(`/api/jobs/${currentDetailJobId}/export?format=csv`, '_blank');
        toast('CSV export started', 'info');
    });

    // ── Keyboard Shortcuts ────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && detailPanel.style.display !== 'none') closeDetail();
    });

    // ── Toast System ──────────────────────────────────────────────────────
    function toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        const icons = { success: 'check_circle', error: 'error', info: 'info' };
        el.innerHTML = `<span class="material-symbols-outlined">${icons[type] || 'info'}</span><span>${escapeHtml(message)}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        }, 3500);
    }

    // ── Utilities ─────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function truncateUrl(url) {
        try {
            const u = new URL(url);
            let display = u.hostname + u.pathname;
            if (display.length > 50) display = display.substring(0, 47) + '...';
            return display;
        } catch {
            return url.length > 50 ? url.substring(0, 47) + '...' : url;
        }
    }

    function formatTime(ts) {
        try {
            const d = new Date(ts + 'Z');
            const now = new Date();
            const diff = Math.floor((now - d) / 1000);
            if (diff < 60) return `${diff}s ago`;
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            return d.toLocaleDateString();
        } catch { return ts; }
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function emptySection(msg) {
        return `<div class="empty-state" style="padding: 2rem;">
            <span class="material-symbols-outlined">search_off</span>
            <span>${msg}</span>
        </div>`;
    }
});
