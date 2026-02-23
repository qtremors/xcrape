/* ═══════════════════════════════════════════════════════════════════════════
   XCRAPE — Material TUI Frontend Logic
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
    const detailJobIdEl = document.getElementById('detailJobId');

    let currentDetailJobId = null;
    let currentDetailData = null;
    let pollInterval = null;

    // ── Init ──────────────────────────────────────────────────────────────
    fetchJobs();
    startPolling();

    // ── Polling ───────────────────────────────────────────────────────────
    function startPolling() {
        pollInterval = setInterval(fetchJobs, 4000);
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
            renderJobs(data.jobs);
            footerJobCount.textContent = data.jobs.length;

            // Update status
            const running = data.jobs.filter(j => j.status === 'running').length;
            const pending = data.jobs.filter(j => j.status === 'pending').length;
            if (running > 0) {
                footerStatus.textContent = `RUNNING (${running})`;
                footerStatus.style.color = 'var(--status-running)';
            } else if (pending > 0) {
                footerStatus.textContent = `PENDING (${pending})`;
                footerStatus.style.color = 'var(--status-pending)';
            } else {
                footerStatus.textContent = 'IDLE';
                footerStatus.style.color = 'var(--md-secondary)';
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
                <tr>
                    <td colspan="5" class="empty-state">
                        <span class="material-symbols-outlined">inbox</span>
                        <span>No jobs in queue. Start a scrape above.</span>
                    </td>
                </tr>`;
            return;
        }

        jobsTableBody.innerHTML = '';
        jobs.forEach(job => {
            const tr = document.createElement('tr');
            const isCompleted = job.status === 'completed';
            if (isCompleted) tr.classList.add('clickable');

            const timeStr = job.created_at
                ? formatTime(job.created_at)
                : '—';

            tr.innerHTML = `
                <td style="color: var(--md-muted); font-weight: 600;">#${job.id}</td>
                <td class="url-cell"><a href="${escapeHtml(job.url)}" target="_blank" title="${escapeHtml(job.url)}">${truncateUrl(job.url)}</a></td>
                <td><span class="status-badge ${job.status}"><span class="status-dot"></span>${job.status}</span></td>
                <td class="time-cell">${timeStr}</td>
                <td class="actions-cell">
                    ${isCompleted ? `<button class="action-btn view-btn" data-id="${job.id}" title="View Data"><span class="material-symbols-outlined">visibility</span></button>` : ''}
                    ${job.status === 'failed' && job.data ? `<button class="action-btn view-btn" data-id="${job.id}" title="View Error"><span class="material-symbols-outlined">error</span></button>` : ''}
                    <button class="action-btn delete delete-btn" data-id="${job.id}" title="Delete"><span class="material-symbols-outlined">delete</span></button>
                </td>
            `;
            jobsTableBody.appendChild(tr);
        });

        // Event: View button
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                openDetail(parseInt(id));
            });
        });

        // Event: Row click (completed jobs)
        document.querySelectorAll('#jobsTable tbody tr.clickable').forEach(row => {
            row.addEventListener('click', () => {
                const viewBtn = row.querySelector('.view-btn');
                if (viewBtn) viewBtn.click();
            });
        });

        // Event: Delete button
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

    // ── Detail Panel ──────────────────────────────────────────────────────
    async function openDetail(jobId) {
        try {
            const resp = await fetch(`/api/jobs/${jobId}`);
            if (!resp.ok) {
                toast('Failed to load job data', 'error');
                return;
            }
            const result = await resp.json();
            const job = result.job;

            if (!job.data) {
                toast('No data available yet', 'info');
                return;
            }

            let parsedData;
            try {
                parsedData = JSON.parse(job.data);
            } catch {
                toast('Invalid job data', 'error');
                return;
            }

            currentDetailJobId = jobId;
            currentDetailData = parsedData;
            detailJobIdEl.textContent = `#${jobId}`;
            detailPanel.style.display = '';

            // If it's an error, show error view
            if (parsedData.error) {
                showErrorDetail(parsedData);
                return;
            }

            // Activate first tab
            const tabs = tabBar.querySelectorAll('.tab');
            tabs.forEach(t => t.classList.remove('active'));
            tabs[0].classList.add('active');
            renderTab('meta');

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
            case 'meta':    renderMeta(d.meta || {}); break;
            case 'headings': renderHeadings(d.headings || []); break;
            case 'links':   renderLinks(d.links || []); break;
            case 'images':  renderImages(d.images || []); break;
            case 'text':    renderText(d.text || []); break;
            case 'tables':  renderTables(d.tables || []); break;
            case 'stats':   renderStats(d.stats || {}); break;
            case 'raw':     renderRaw(d); break;
        }
    }

    // ── Tab Renderers ─────────────────────────────────────────────────────

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

        let html = '<div class="meta-grid">';
        fields.forEach(f => {
            const val = f.value || '';
            html += `
                <div class="meta-item">
                    <div class="meta-label">${f.label}</div>
                    <div class="meta-value ${!val ? 'empty' : ''}">${val ? escapeHtml(val) : '—'}</div>
                </div>`;
        });

        // Selector results if present
        const sr = currentDetailData.selector_results;
        if (sr && sr.length > 0) {
            html += `</div><div class="section-count" style="margin-top: 1rem;">CSS Selector Results: <span>${sr.length}</span> matches</div><ul class="data-list">`;
            sr.forEach(item => {
                html += `<li>
                    <span class="heading-level">&lt;${item.tag}&gt;</span>
                    <span>${escapeHtml(item.text)}</span>
                </li>`;
            });
            html += '</ul>';
        } else {
            html += '</div>';
        }

        tabContent.innerHTML = html;
    }

    function renderHeadings(headings) {
        if (headings.length === 0) {
            tabContent.innerHTML = emptySection('No headings found');
            return;
        }
        let html = `<div class="section-count">Found <span>${headings.length}</span> headings</div><ul class="data-list">`;
        headings.forEach(h => {
            const indent = (h.level - 1) * 12;
            html += `<li style="padding-left: ${indent + 12}px;">
                <span class="heading-level">H${h.level}</span>
                <span>${escapeHtml(h.text)}</span>
            </li>`;
        });
        html += '</ul>';
        tabContent.innerHTML = html;
    }

    function renderLinks(links) {
        if (links.length === 0) {
            tabContent.innerHTML = emptySection('No links found');
            return;
        }
        const internal = links.filter(l => l.internal).length;
        const external = links.length - internal;
        let html = `<div class="section-count">Found <span>${links.length}</span> links (${internal} internal, ${external} external)</div><ul class="data-list">`;
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
    }

    function renderImages(images) {
        if (images.length === 0) {
            tabContent.innerHTML = emptySection('No images found');
            return;
        }
        let html = `<div class="section-count">Found <span>${images.length}</span> images</div><div class="image-grid">`;
        images.forEach(img => {
            const dims = (img.width || img.height)
                ? `${img.width || '?'} × ${img.height || '?'}`
                : '';
            html += `<div class="image-card">
                <div class="image-src">${escapeHtml(img.src)}</div>
                ${img.alt ? `<div class="image-alt">"${escapeHtml(img.alt)}"</div>` : ''}
                ${dims ? `<div class="image-dims">${dims}</div>` : ''}
            </div>`;
        });
        html += '</div>';
        tabContent.innerHTML = html;
    }

    function renderText(text) {
        if (text.length === 0) {
            tabContent.innerHTML = emptySection('No text content extracted');
            return;
        }
        let html = `<div class="section-count">Extracted <span>${text.length}</span> paragraphs</div>`;
        text.forEach(p => {
            html += `<div class="text-block">${escapeHtml(p)}</div>`;
        });
        tabContent.innerHTML = html;
    }

    function renderTables(tables) {
        if (tables.length === 0) {
            tabContent.innerHTML = emptySection('No tables found');
            return;
        }
        let html = `<div class="section-count">Found <span>${tables.length}</span> tables</div>`;
        tables.forEach((table, idx) => {
            html += `<div style="margin-bottom: 0.5rem; color: var(--md-muted); font-size: 0.72rem;">TABLE ${idx + 1} (${table.length} rows)</div>`;
            html += '<div class="table-wrap"><table class="scraped-table">';
            table.forEach((row, ri) => {
                const tag = ri === 0 ? 'th' : 'td';
                html += '<tr>';
                row.forEach(cell => {
                    html += `<${tag}>${escapeHtml(cell)}</${tag}>`;
                });
                html += '</tr>';
            });
            html += '</table></div>';
        });
        tabContent.innerHTML = html;
    }

    function renderStats(stats) {
        const items = [
            { label: 'Words', value: stats.word_count, icon: 'text_fields' },
            { label: 'Links', value: stats.link_count, icon: 'link' },
            { label: 'Internal Links', value: stats.internal_links, icon: 'home' },
            { label: 'External Links', value: stats.external_links, icon: 'open_in_new' },
            { label: 'Images', value: stats.image_count, icon: 'image' },
            { label: 'Headings', value: stats.heading_count, icon: 'title' },
            { label: 'Tables', value: stats.table_count, icon: 'table_view' },
            { label: 'Lists', value: stats.list_count, icon: 'list' },
            { label: 'Scripts', value: stats.script_count, icon: 'code' },
            { label: 'Inline Scripts', value: stats.inline_script_count, icon: 'data_object' },
            { label: 'Stylesheets', value: stats.style_count, icon: 'palette' },
            { label: 'Load Time', value: stats.load_time_seconds ? `${stats.load_time_seconds}s` : '—', icon: 'timer' },
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
        tabContent.innerHTML = `<pre class="raw-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }

    function showErrorDetail(data) {
        tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tabContent.innerHTML = `
            <div class="error-display">
                <div class="error-type">${escapeHtml(data.error_type || 'Error')}</div>
                <div class="error-message">${escapeHtml(data.error || 'Unknown error')}</div>
                ${data.load_time_seconds ? `<div style="margin-top: 0.5rem; color: var(--md-muted); font-size: 0.78rem;">Failed after ${data.load_time_seconds}s</div>` : ''}
            </div>`;
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
        if (e.key === 'Escape' && detailPanel.style.display !== 'none') {
            closeDetail();
        }
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
            if (display.length > 45) display = display.substring(0, 42) + '...';
            return display;
        } catch {
            return url.length > 45 ? url.substring(0, 42) + '...' : url;
        }
    }

    function formatTime(ts) {
        try {
            const d = new Date(ts + 'Z'); // SQLite timestamps are UTC
            const now = new Date();
            const diff = Math.floor((now - d) / 1000);

            if (diff < 60)   return `${diff}s ago`;
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            return d.toLocaleDateString();
        } catch {
            return ts;
        }
    }

    function emptySection(msg) {
        return `<div class="empty-state" style="padding: 2rem;"}>
            <span class="material-symbols-outlined">search_off</span>
            <span>${msg}</span>
        </div>`;
    }
});
