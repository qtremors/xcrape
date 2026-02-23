document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('scrapeForm');
    const jobsTableBody = document.querySelector('#jobsTable tbody');

    // Fetch jobs on load
    fetchJobs();

    // Poll for jobs every 5 seconds
    setInterval(fetchJobs, 5000);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const url = document.getElementById('url').value;
        const selector = document.getElementById('selector').value;
        
        const btn = form.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Starting...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, selector: selector || null })
            });
            
            if (response.ok) {
                document.getElementById('url').value = '';
                document.getElementById('selector').value = '';
                fetchJobs(); // Update the table instantly
            } else {
                alert('Failed to start job.');
            }
        } catch (error) {
            console.error('Error starting scrape:', error);
            alert('An error occurred. Check browser console.');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    async function fetchJobs() {
        try {
            const response = await fetch('/api/jobs');
            const data = await response.json();
            renderJobs(data.jobs);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        }
    }

    function renderJobs(jobs) {
        if (!jobs || jobs.length === 0) {
            jobsTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No jobs available</td></tr>`;
            return;
        }

        jobsTableBody.innerHTML = '';
        jobs.forEach(job => {
            let statusColor = 'var(--text-muted)';
            if (job.status === 'completed') statusColor = 'var(--success)';
            if (job.status === 'failed') statusColor = 'var(--danger)';
            if (job.status === 'running') statusColor = 'var(--accent)';

            const tr = document.createElement('tr');
            
            // Safe parsing of data to pass to button
            let dataAttr = '';
            let actionHtml = `<span class="text-muted">N/A</span>`;
            if (job.data) {
                try {
                    // escape quotes for attribute
                    dataAttr = encodeURIComponent(job.data);
                    actionHtml = `<button class="btn btn-view" data-json="${dataAttr}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--accent); border-radius: 4px; cursor: pointer;">View JSON</button>`;
                } catch (e) {
                    actionHtml = `<span class="text-muted">Invalid Data</span>`;
                }
            }

            tr.innerHTML = `
                <td>#${job.id}</td>
                <td><a href="${job.url}" target="_blank" style="color: var(--text-primary); text-decoration: none;">${job.url}</a></td>
                <td style="color: ${statusColor}; font-weight: 500; text-transform: capitalize;">${job.status}</td>
                <td>${actionHtml}</td>
            `;
            jobsTableBody.appendChild(tr);
        });

        // Add event listeners to "View JSON" buttons
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const encodedData = e.target.getAttribute('data-json');
                if (encodedData) {
                    try {
                        const rawData = decodeURIComponent(encodedData);
                        const parsedData = JSON.parse(rawData);
                        showModal(JSON.stringify(parsedData, null, 2));
                    } catch (err) {
                        showModal(decodeURIComponent(encodedData));
                    }
                }
            });
        });
    }

    // Modal Handling
    const modal = document.getElementById('dataModal');
    const modalData = document.getElementById('modalData');
    const closeModalBtn = document.querySelector('.close-modal');

    function showModal(content) {
        modalData.textContent = content;
        modal.classList.add('show');
    }

    function hideModal() {
        modal.classList.remove('show');
        modalData.textContent = '';
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideModal);
    }

    // Close when clicking outside of modal content
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });
});
