// CONFIGURATION: Real cloud data parameters hooked up to your production database backend
const SUPABASE_URL = "https://mmrrhxwotzbjfmhedogj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcnJoeHdvdHpiamZtaGVkb2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk5NDksImV4cCI6MjA5NzgxNTk0OX0.MLpgR4jTs2RIo1TY0jFRUIhwgnlETOTyrYh4kW71NuE";
const RECORD_ID = "user_pipeline_tracker"; 

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State runtime engines
let metrics = { dev_streak: 0, study_streak: 0, lc_easy: 0, lc_medium: 0, lc_hard: 0, aws_domains: [false, false, false, false] };
let applicationsList = [];

const awsDomainLabels = [
    "Data Engineering (S3, Glue, Kinesis)",
    "Exploratory Data Analysis (SageMaker, Athena)",
    "Modeling (Algorithms, Hyperparameters)",
    "ML Operations & Security (Pipelines, IAM)"
];

window.onload = async function() {
    await loadAllDatabaseData();
    renderDashboard();
};

// Fluid section navigation calculation logic
function scrollToDashboard() {
    document.getElementById('dashboard-section').scrollIntoView({ behavior: 'smooth' });
}

// Database Connection Orchestrators
async function loadAllDatabaseData() {
    updateSyncStatus("Syncing with cloud tables...", "text-yellow-400");
    try {
        const appRes = await _supabase.from('job_applications').select('*').order('id', { ascending: false });
        if (appRes.error) throw appRes.error;
        applicationsList = appRes.data || [];

        const metricsRes = await _supabase.from('user_metrics').select('*').eq('id', RECORD_ID).single();
        if (metricsRes.error && metricsRes.error.code !== 'PGRST116') throw metricsRes.error;
        if (metricsRes.data) metrics = metricsRes.data;

        updateSyncStatus("Cloud Synced", "text-emerald-400");
    } catch (err) {
        console.error("Database connection fault:", err);
        updateSyncStatus("Database Sync Error", "text-red-400");
    }
}

function updateSyncStatus(text, colorClass) {
    const statusEl = document.getElementById('sync-status');
    statusEl.innerText = text;
    statusEl.className = `text-xs bg-gray-900 px-3 py-1.5 rounded-md border border-gray-800 ${colorClass}`;
}

// Render Controllers
function renderDashboard() {
    document.getElementById('app-count').innerText = applicationsList.length;
    
    document.getElementById('dev-streak').innerText = `${metrics.dev_streak} days`;
    document.getElementById('study-streak').innerText = `${metrics.study_streak} days`;
    
    document.getElementById('lc-easy').value = metrics.lc_easy;
    document.getElementById('lc-medium').value = metrics.lc_medium;
    document.getElementById('lc-hard').value = metrics.lc_hard;
    document.getElementById('lc-total').innerText = metrics.lc_easy + metrics.lc_medium + metrics.lc_hard;

    const awsContainer = document.getElementById('aws-checklist');
    awsContainer.innerHTML = '';
    let completedDomains = 0;
    metrics.aws_domains.forEach((isChecked, index) => {
        if (isChecked) completedDomains++;
        awsContainer.innerHTML += `
            <label class="flex items-center gap-3 cursor-pointer text-sm text-gray-300 hover:text-white transition">
                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleAwsDomain(${index})" class="rounded border-gray-700 bg-gray-950 text-purple-500 focus:ring-purple-500 w-4 h-4">
                <span>${awsDomainLabels[index]}</span>
            </label>
        `;
    });
    const awsPct = Math.round((completedDomains / metrics.aws_domains.length) * 100);
    document.getElementById('aws-progress-bar').style.width = `${awsPct}%`;
    document.getElementById('aws-progress-text').innerText = `${awsPct}% Complete`;

    const tbody = document.getElementById('app-table-body');
    tbody.innerHTML = '';
    applicationsList.forEach((app) => {
        tbody.innerHTML += `
            <tr class="hover:bg-gray-900/50 transition">
                <td class="py-3 px-4 font-semibold text-white">${escapeHtml(app.company)}</td>
                <td class="py-3 px-4">${escapeHtml(app.position || '')}</td>
                <td class="py-3 px-4">
                <select onchange="updateAppStatus(${app.id}, this.value)" class="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none">
                    <option value="Applied" ${app.status === 'Applied' ? 'selected="selected"' : ''}>Applied</option>
                    <option value="Interviewing" ${app.status === 'Interviewing' ? 'selected="selected"' : ''}>Interviewing</option>
                    <option value="Offer" ${app.status === 'Offer' ? 'selected="selected"' : ''}>Offer</option>
                    <option value="Rejected" ${app.status === 'Rejected' ? 'selected="selected"' : ''}>Archived</option>
                </select>
                </td>
                <td class="py-3 px-4 text-right">
                    <button onclick="deleteApplication(${app.id})" class="text-xs text-red-400 hover:text-red-300 transition">Delete</button>
                </td>
            </tr>
        `;
    });
}

// Interactive Pipeline Handlers
async function changeStreak(type, val) {
    if (type === 'dev') { metrics.dev_streak = (parseInt(metrics.dev_streak) || 0) + val; }
    if (type === 'study') { metrics.study_streak = (parseInt(metrics.study_streak) || 0) + val; }
    renderDashboard();
    await saveMetricsRow();
}

async function resetStreaks() {
    if(confirm("Reset consistency tracking metrics?")) {
        metrics.dev_streak = 0;
        metrics.study_streak = 0;
        renderDashboard();
        await saveMetricsRow();
    }
}

async function updateLeetCode() {
    metrics.lc_easy = parseInt(document.getElementById('lc-easy').value) || 0;
    metrics.lc_medium = parseInt(document.getElementById('lc-medium').value) || 0;
    metrics.lc_hard = parseInt(document.getElementById('lc-hard').value) || 0;
    renderDashboard();
    await saveMetricsRow();
}

async function toggleAwsDomain(index) {
    metrics.aws_domains[index] = !metrics.aws_domains[index];
    renderDashboard();
    await saveMetricsRow();
}

async function addApplication(e) {
    e.preventDefault();
    updateSyncStatus("Adding row...", "text-yellow-400");
    const companyEl = document.getElementById('app-company');
    const roleEl = document.getElementById('app-role');

    try {
        const { data, error } = await _supabase
            .from('job_applications')
            .insert([{ company: companyEl.value, position: roleEl.value, status: 'Applied' }])
            .select();

        if (error) throw error;
        
        applicationsList.unshift(data[0]);
        companyEl.value = '';
        roleEl.value = '';
        updateSyncStatus("Cloud Synced", "text-emerald-400");
        renderDashboard();
    } catch (err) {
        console.error("Failed inserting row:", err);
        updateSyncStatus("Error Adding Row", "text-red-400");
    }
}

async function updateAppStatus(id, status) {
    updateSyncStatus("Updating row status...", "text-yellow-400");
    try {
        const { error } = await _supabase.from('job_applications').update({ status: status }).eq('id', id);
        if (error) throw error;
        
        const target = applicationsList.find(a => a.id === id);
        if (target) target.status = status;
        updateSyncStatus("Cloud Synced", "text-emerald-400");
    } catch (err) {
        console.error("Status modify failed:", err);
        updateSyncStatus("Status Save Error", "text-red-400");
    }
}

async function deleteApplication(id) {
    updateSyncStatus("Deleting row...", "text-yellow-400");
    try {
        const { error } = await _supabase.from('job_applications').delete().eq('id', id);
        if (error) throw error;
        
        applicationsList = applicationsList.filter(a => a.id !== id);
        updateSyncStatus("Cloud Synced", "text-emerald-400");
        renderDashboard();
    } catch (err) {
        console.error("Row delete failed:", err);
        updateSyncStatus("Delete Error", "text-red-400");
    }
}

async function saveMetricsRow() {
    updateSyncStatus("Syncing metrics...", "text-yellow-400");
    try {
        const { error } = await _supabase.from('user_metrics').upsert({ id: RECORD_ID, ...metrics });
        if (error) throw error;
        updateSyncStatus("Cloud Synced", "text-emerald-400");
    } catch (err) {
        console.error("Metrics sync error:", err);
        updateSyncStatus("Sync Error", "text-red-400");
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}