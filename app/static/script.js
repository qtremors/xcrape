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

            // Data truncating for display
            let displayData = '';
            if (job.data) {
                if (job.data.length > 50) {
                    displayData = job.data.substring(0, 50) + '...';
                } else {
                    displayData = job.data;
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${job.id}</td>
                <td><a href="${job.url}" target="_blank" style="color: var(--text-primary); text-decoration: none;">${job.url}</a></td>
                <td style="color: ${statusColor}; font-weight: 500; text-transform: capitalize;">${job.status}</td>
                <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${displayData || 'N/A'}</td>
            `;
            jobsTableBody.appendChild(tr);
        });
    }
});
