// REPLACE THIS WITH YOUR DEPLOYED GOOGLE APPS SCRIPT EXEC URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxHJg2r1zkY5PgAYPYA-DiSHfgeu1A-nvkkDm5FXHoGCJRENx-f9kphPSEq300XqLk/exec';

let charts = {};

window.onload = () => {
  fetch(`${API_URL}?action=getInitialData`)
    .then(res => res.json())
    .then(renderMainView);
};

function renderMainView(data) {
  const bList = document.getElementById('behavior-list');
  bList.innerHTML = data.behaviors.map(b => `<li>${b}</li>`).join('');

  const sList = document.getElementById('student-list');
  sList.innerHTML = data.students.map(s => 
    `<button class="btn" onclick="loadStudent('${s}')">${s}</button>`
  ).join('');
}

function openModal() { 
  document.getElementById('modal').classList.remove('hidden'); 
}

function closeModal() { 
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('new-behavior-input').value = '';
}

function submitBehavior() {
  const val = document.getElementById('new-behavior-input').value.trim();
  if (!val) return;
  closeModal();

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'addBehavior', behavior: val })
  })
  .then(res => res.json())
  .then(renderMainView);
}

function loadStudent(name) {
  document.getElementById('main-view').classList.add('hidden');
  document.getElementById('student-view').classList.remove('hidden');
  document.getElementById('student-title').innerText = `${name}'s Behaviors`;
  document.getElementById('student-behavior-list').innerHTML = '<li>Loading...</li>';

  fetch(`${API_URL}?action=getStudentData&studentName=${encodeURIComponent(name)}`)
    .then(res => res.json())
    .then(renderStudentView);
}

function goBack() {
  document.getElementById('student-view').classList.add('hidden');
  document.getElementById('main-view').classList.remove('hidden');
}

function addInstance(studentName, colIndex) {
  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'addBehaviorInstance', studentName, colIndex })
  })
  .then(res => res.json())
  .then(renderStudentView);
}

function renderStudentView(data) {
  if (!data) return;
  
  const list = document.getElementById('student-behavior-list');
  list.innerHTML = data.behaviors.map(b => `
    <li>
      <span>${b.name} <span class="badge">${b.count}</span></span>
      <button class="btn add-btn" onclick="addInstance('${data.studentName}', ${b.colIndex})">+</button>
    </li>
  `).join('');

  renderCharts(data);
}

function renderCharts(data) {
  ['pieChart', 'timeChart', 'dayChart'].forEach(id => {
    if (charts[id]) charts[id].destroy();
  });

  // 1. Pie Chart
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  charts['pieChart'] = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: data.behaviors.map(b => b.name),
      datasets: [{ data: data.behaviors.map(b => b.count) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const timeBins = Array(31).fill(0);
  const dayBins = Array(5).fill(0);

  data.timestamps.forEach(ts => {
    const d = new Date(ts.time);
    
    // Day calculation (Mon=0 to Fri=4)
    const day = d.getDay();
    if (day >= 1 && day <= 5) dayBins[day - 1]++;
    
    // Time calculation (8:00 to 15:30)
    const h = d.getHours();
    const m = d.getMinutes();
    if (h >= 8 && h <= 15) {
      if (h === 15 && m > 30) return;
      const minSince8 = (h - 8) * 60 + m;
      const binIndex = Math.floor(minSince8 / 15);
      if (binIndex >= 0 && binIndex < 31) timeBins[binIndex]++;
    }
  });

  // 2. Time Bins Chart
  const timeLabels = Array.from({length: 31}, (_, i) => {
    const mins = i * 15;
    const h = 8 + Math.floor(mins / 60);
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  });

  const timeCtx = document.getElementById('timeChart').getContext('2d');
  charts['timeChart'] = new Chart(timeCtx, {
    type: 'bar',
    data: {
      labels: timeLabels,
      datasets: [{ label: 'Incidents (8:00 - 3:30)', data: timeBins, backgroundColor: '#3b82f6' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // 3. Day of Week Chart
  const dayCtx = document.getElementById('dayChart').getContext('2d');
  charts['dayChart'] = new Chart(dayCtx, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      datasets: [{ label: 'Incidents by Day', data: dayBins, backgroundColor: '#8b5cf6' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
