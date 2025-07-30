document.addEventListener('DOMContentLoaded', () => {
    // Immediately run feather icons replacement
    feather.replace();
    
    // Add a cache-busting parameter to the fetch URL to avoid stale data from browser cache
    fetch('data.json?v=' + new Date().getTime())
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => processData(data))
        .catch(error => {
            console.error('Error fetching or parsing data:', error);
            document.getElementById('rank').innerText = "Error";
            const lastUpdatedElem = document.getElementById('lastUpdated');
            lastUpdatedElem.innerHTML = `<i data-feather="alert-triangle"></i> Connection Lost`;
            feather.replace(); // Re-run for new icon
        });
});

function processData(data) {
    const logs = data.logs || [];
    if (logs.length === 0) {
        const lastUpdatedElem = document.getElementById('lastUpdated');
        lastUpdatedElem.innerHTML = `<i data-feather="clock"></i> No missions logged yet.`;
        feather.replace();
        return;
    }

    // --- Calculations ---
    let totalScore = 0;
    logs.forEach(log => {
        totalScore += (log.titan_pts + log.oracle_pts + log.sage_pts + log.bonus_pts);
    });

    const rank = getRank(totalScore);

    // --- Get latest data ---
    const latestLog = logs[logs.length - 1];
    const lastUpdatedDate = new Date(latestLog.date);
    
    // --- Update DOM ---
    document.getElementById('rank').innerText = rank;
    document.getElementById('totalScore').innerText = totalScore;
    
    const lastUpdatedElem = document.getElementById('lastUpdated');
    lastUpdatedElem.innerHTML = `<i data-feather="check-circle"></i> Last Synced: ${lastUpdatedDate.toLocaleString()}`;
    
    document.getElementById('messageFromHq').innerText = latestLog.notes;

    // --- Render Charts ---
    renderDailyChart(latestLog);
    renderHistoryChart(logs);
    
    // Re-run Feather Icons after dynamic content is loaded
    feather.replace();
}

function getRank(score) {
    const ranks = {
        RECRUIT: { threshold: 0, next: 250, color: 'var(--rank-recruit)', icon: '●' },
        OPERATIVE: { threshold: 250, next: 600, color: 'var(--rank-operative)', icon: '◆' },
        SPECIALIST: { threshold: 600, next: 1200, color: 'var(--rank-specialist)', icon: '★' },
        COMMANDER: { threshold: 1200, next: Infinity, color: 'var(--rank-commander)', icon: '✪' }
    };

    let currentRankName = 'RECRUIT';
    let currentRankData = ranks.RECRUIT;
    
    if (score >= ranks.COMMANDER.threshold) {
        currentRankName = 'COMMANDER';
    } else if (score >= ranks.SPECIALIST.threshold) {
        currentRankName = 'SPECIALIST';
    } else if (score >= ranks.OPERATIVE.threshold) {
        currentRankName = 'OPERATIVE';
    }
    
    currentRankData = ranks[currentRankName];
    
    // --- Update Progress Bar & Rank Icon ---
    const rankIconElement = document.getElementById('rankIcon');
    const progressBarElement = document.getElementById('rankProgress');
    const progressLabelElement = document.querySelector('.progress-label');

    const nextRankIndex = Object.keys(ranks).indexOf(currentRankName) + 1;
    const nextRankName = nextRankIndex < Object.keys(ranks).length ? Object.keys(ranks)[nextRankIndex] : 'MAX';
    
    const scoreInCurrentRank = score - currentRankData.threshold;
    const scoreToNextRank = currentRankData.next - currentRankData.threshold;
    
    const progressPercentage = (scoreToNextRank === Infinity) ? 100 : Math.min((scoreInCurrentRank / scoreToNextRank) * 100, 100);
    
    if (rankIconElement) rankIconElement.style.color = currentRankData.color;
    if (rankIconElement) rankIconElement.textContent = currentRankData.icon;
    if (progressBarElement) progressBarElement.style.width = `${progressPercentage}%`;
    if (progressBarElement) progressBarElement.style.backgroundColor = currentRankData.color;
    
    if (nextRankName !== 'MAX' && progressLabelElement){
       progressLabelElement.textContent = `${score} / ${currentRankData.next} XP to ${nextRankName}`;
    } else if (progressLabelElement) {
       progressLabelElement.textContent = 'MAXIMUM RANK ACHIEVED';
    }

    return currentRankName;
}

function renderDailyChart(log) {
    const ctx = document.getElementById('dailyChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['TITAN', 'ORACLE', 'SAGE', 'Bonus'],
            datasets: [{
                data: [log.titan_pts, log.oracle_pts, log.sage_pts, log.bonus_pts],
                backgroundColor: ['var(--accent-red)', 'var(--primary)', 'var(--accent-green)', 'var(--accent-orange)'],
                borderColor: 'var(--card-background)',
                borderWidth: 5,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw} Points`;
                        }
                    }
                }
            }
        }
    });
}

function renderHistoryChart(logs) {
    // Ensure we have at least 7 days of data for context, padding with zeros if necessary
    let labels = [];
    let dataPoints = [];
    
    const last7Logs = logs.slice(-7);
    
    for (let i = 0; i < 7; i++) {
        if (i < last7Logs.length) {
            const log = last7Logs[i];
            labels.push(new Date(log.date).toLocaleDateString('en-US', { weekday: 'short' }));
            dataPoints.push(log.titan_pts + log.oracle_pts + log.sage_pts + log.bonus_pts);
        } else {
            // This part can be adjusted if you prefer not to show empty slots
        }
    }
    
    const ctx = document.getElementById('historyChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Daily Score',
                data: dataPoints,
                backgroundColor: 'var(--primary)',
                borderRadius: 4,
                barThickness: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'var(--border)' },
                    ticks: { color: 'var(--muted-foreground)' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'var(--muted-foreground)' }
                }
            },
            plugins: {
                legend: { display: false },
                 tooltip: {
                    callbacks: {
                        title: function(context) {
                            // Custom tooltip title if needed
                            return `Report: ${context[0].label}`;
                        },
                        label: function(context) {
                            return `Total Score: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });
}