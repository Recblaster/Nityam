let ALL_LOGS = []; // Global variable to store all logs

document.addEventListener('DOMContentLoaded', () => {
    feather.replace(); // Initialize feather icons

    // Fetch data with cache busting
    fetch('data.json?v=' + new Date().getTime())
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            ALL_LOGS = data.logs || []; // Store all logs globally

            if (ALL_LOGS.length === 0) {
                const lastUpdatedElem = document.getElementById('lastUpdated');
                lastUpdatedElem.innerHTML = `<i data-feather="clock"></i> No missions logged yet.`;
                feather.replace();
                // Initialize date selector with today's date but no data loaded
                initDateSelector(null);
                return;
            }

            // --- Initial Data Processing and Display ---
            processOverallData();
            
            // --- Initialize Date Selector ---
            initDateSelector(ALL_LOGS);

            // Display the latest day's data by default
            displaySelectedDayData(ALL_LOGS[ALL_LOGS.length - 1]);
            
            // Re-run Feather Icons after dynamic content is loaded
            feather.replace();
        })
        .catch(error => {
            console.error('Error fetching or parsing data:', error);
            document.getElementById('rank').innerText = "Error";
            const lastUpdatedElem = document.getElementById('lastUpdated');
            lastUpdatedElem.innerHTML = `<i data-feather="alert-triangle"></i> Connection Lost`;
            feather.replace(); // Re-run for new icon
        });
});

function processOverallData() {
    let totalScore = 0;
    ALL_LOGS.forEach(log => {
        totalScore += (log.titan_pts + log.oracle_pts + log.sage_pts + log.bonus_pts);
    });

    const rank = getRank(totalScore); // This function also updates progress bar
    document.getElementById('rank').innerText = rank;
    document.getElementById('totalScore').innerText = totalScore;

    // Update Last Synced timestamp based on the very last log entry
    const latestLog = ALL_LOGS[ALL_LOGS.length - 1];
    const lastUpdatedDate = new Date(latestLog.date);
    const lastUpdatedElem = document.getElementById('lastUpdated');
    lastUpdatedElem.innerHTML = `<i data-feather="check-circle"></i> Last Synced: ${lastUpdatedDate.toLocaleString()}`;
    feather.replace();

    // Render history chart (always based on latest 7 days)
    renderHistoryChart(ALL_LOGS);
}


function initDateSelector(logs) {
    const dateSelector = document.getElementById('dateSelector');
    if (!logs || logs.length === 0) {
        // Set default to today if no logs, but keep it empty conceptually
        const today = new Date();
        dateSelector.value = today.toISOString().split('T')[0];
        return;
    }

    const firstLogDate = new Date(logs[0].date);
    const lastLogDate = new Date(logs[logs.length - 1].date);

    // Set min/max dates for the picker
    dateSelector.min = firstLogDate.toISOString().split('T')[0];
    dateSelector.max = lastLogDate.toISOString().split('T')[0];
    
    // Set initial value to the latest log date
    dateSelector.value = lastLogDate.toISOString().split('T')[0];

    // Add event listener for date changes
    dateSelector.addEventListener('change', (event) => {
        const selectedDateString = event.target.value; // YYYY-MM-DD
        const selectedLog = ALL_LOGS.find(log => {
            return new Date(log.date).toISOString().split('T')[0] === selectedDateString;
        });

        if (selectedLog) {
            displaySelectedDayData(selectedLog);
        } else {
            // Handle case where no log exists for the selected date
            clearDailyDetails();
            document.getElementById('selectedDateDisplay').innerText = new Date(selectedDateString).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            document.getElementById('messageFromHq').innerText = "No mission report found for this day.";
            // Clear daily chart
            if (window.dailyChartInstance) window.dailyChartInstance.destroy();
            document.getElementById('dailyChart').getContext('2d').clearRect(0, 0, document.getElementById('dailyChart').width, document.getElementById('dailyChart').height);
        }
        feather.replace(); // Re-render icons if message changes
    });
}

// Function to clear daily details if no data for selected day
function clearDailyDetails() {
    document.getElementById('dailyTitanPts').innerText = '0';
    document.getElementById('dailyOraclePts').innerText = '0';
    document.getElementById('dailySagePts').innerText = '0';
    document.getElementById('dailyBonusPts').innerText = '0';
    document.getElementById('dailyTotalPts').innerText = '0';
}


function displaySelectedDayData(log) {
    document.getElementById('selectedDateDisplay').innerText = new Date(log.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('hqMessageDate').innerText = new Date(log.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

    document.getElementById('dailyTitanPts').innerText = log.titan_pts;
    document.getElementById('dailyOraclePts').innerText = log.oracle_pts;
    document.getElementById('dailySagePts').innerText = log.sage_pts;
    document.getElementById('dailyBonusPts').innerText = log.bonus_pts;
    document.getElementById('dailyTotalPts').innerText = log.titan_pts + log.oracle_pts + log.sage_pts + log.bonus_pts;
    document.getElementById('messageFromHq').innerText = log.notes;

    // Render daily chart for the selected log
    renderDailyChart(log);
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

// Store chart instances globally to destroy and re-create them
let dailyChartInstance = null;
let historyChartInstance = null;

function renderDailyChart(log) {
    const ctx = document.getElementById('dailyChart').getContext('2d');
    if (dailyChartInstance) {
        dailyChartInstance.destroy();
    }
    dailyChartInstance = new Chart(ctx, {
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
    const labels = [];
    const dataPoints = [];
    
    // Get the last 7 logs, ensuring we have full days for labels even if data is missing
    const numLogs = logs.length;
    const startIndex = Math.max(0, numLogs - 7);
    const last7Logs = logs.slice(startIndex);
    
    for (let i = 0; i < last7Logs.length; i++) {
        const log = last7Logs[i];
        labels.push(new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));
        dataPoints.push(log.titan_pts + log.oracle_pts + log.sage_pts + log.bonus_pts);
    }
    
    const ctx = document.getElementById('historyChart').getContext('2d');
    if (historyChartInstance) {
        historyChartInstance.destroy();
    }
    historyChartInstance = new Chart(ctx, {
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
