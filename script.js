// REPLACE THIS WITH YOUR DEPLOYED GOOGLE APPS SCRIPT EXEC URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxHJg2r1zkY5PgAYPYA-DiSHfgeu1A-nvkkDm5FXHoGCJRENx-f9kphPSEq300XqLk/exec';

let charts = {};

window.onload = () => {
  fetch(`${API_URL}?action=getInitialData`)
    .then(res => res.json())
    .then(renderMainView)
    .catch(err => console.error("Error loading initial data:", err));
};

function renderMainView(data) {
  const bList = document.getElementById('behavior-list');
  if (bList && data.behaviors) {
    bList.innerHTML = data.behaviors.map(b => `<li>${b}</li>`).join('');
  }

  const sList = document.getElementById('student-list');
  if (sList && data.students) {
    sList.innerHTML = data.students.map(s => 
      `<button class="btn" onclick="loadStudent('${s}')">${s}</button>`
    ).join('');
  }
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
  .then(renderMainView)
  .catch(err => console.error("Error submitting behavior:", err));
}

function loadStudent(name) {
  document.getElementById('main-view').classList.add('hidden');
  document.getElementById('global-data-view').classList.add('hidden');
  document.getElementById('student-view').classList.remove('hidden');
  document.getElementById('student-title').innerText = `${name}'s Behaviors`;
  document.getElementById('student-behavior-list').innerHTML = '<li>Loading...</li>';

  fetch(`${API_URL}?action=getStudentData&studentName=${encodeURIComponent(name)}`)
    .then(res => res.json())
    .then(renderStudentView)
    .catch(err => console.error("Error loading student data:", err));
}

function goBack() {
  document.getElementById('student-view').classList.add('hidden');
  document.getElementById('main-view').classList.remove('hidden');
}

function goBackFromGlobal() {
  document.getElementById('global-data-view').classList.add('hidden');
  document.getElementById('main-view').classList.remove('hidden');
}

function addInstance(studentName, colIndex) {
  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'addBehaviorInstance', studentName, colIndex })
  })
  .then(res => res.json())
  .then(renderStudentView)
  .catch(err => console.error("Error adding instance:", err));
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

  renderStudentCharts(data);
}

function renderStudentCharts(data) {
  ['pieChart', 'timeChart', 'dayChart'].forEach(id => {
    if (charts[id]) charts[id].destroy();
  });

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
    const day = d.getDay();
    if (day >= 1 && day <= 5) dayBins[day - 1]++;
    
    const h = d.getHours();
    const m = d.getMinutes();
    if (h >= 8 && h <= 15) {
      if (h === 15 && m > 30) return;
      const minSince8 = (h - 8) * 60 + m;
      const binIndex = Math.floor(minSince8 / 15);
      if (binIndex >= 0 && binIndex < 31) timeBins[binIndex]++;
    }
  });

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

function loadGlobalBehaviorData() {
  // Immediately switch screens
  document.getElementById('main-view').classList.add('hidden');
  document.getElementById('global-data-view').classList.remove('hidden');

  fetch(`${API_URL}?action=getGlobalBehaviorData`)
    .then(res => {
      if (!res.ok) throw new Error("HTTP network response was not OK");
      return res.json();
    })
    .then(data => {
      if (data.error) {
        alert("Server error: " + data.error);
        return;
      }
      renderGlobalCharts(data);
    })
    .catch(err => {
      console.error("Error fetching global behavior data:", err);
      alert("Failed to load global data. Check console for details.");
    });
}

function renderGlobalCharts(data) {
  ['globalStudentsPerBehaviorChart', 'globalInstancesPerBehaviorChart', 'globalGradePrevalenceChart', 'globalTimeOfDayChart'].forEach(id => {
    if (charts[id]) charts[id].destroy();
  });

  const colorPalette = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', 
    '#6366f1', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
  ];

  // 1. Students Per Behavior
  const spbCtx = document.getElementById('globalStudentsPerBehaviorChart').getContext('2d');
  charts['globalStudentsPerBehaviorChart'] = new Chart(spbCtx, {
    type: 'bar',
    data: {
      labels: data.behaviorNames,
      datasets: [{ label: 'Students assigned per Behavior', data: data.studentsPerBehavior, backgroundColor: '#3b82f6' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // 2. Instances Per Behavior
  const ipbCtx = document.getElementById('globalInstancesPerBehaviorChart').getContext('2d');
  charts['globalInstancesPerBehaviorChart'] = new Chart(ipbCtx, {
    type: 'bar',
    data: {
      labels: data.behaviorNames,
      datasets: [{ label: 'Total Instances across all Students', data: data.instancesPerBehavior, backgroundColor: '#8b5cf6' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // 3. Prevalence by Grade Level (Stacked Bar Chart)
  const gradeCtx = document.getElementById('globalGradePrevalenceChart').getContext('2d');
  const gradeDatasets = data.behaviorNames.map((bName, idx) => ({
    label: bName,
    data: data.gradePrevalence.data[bName] || [],
    backgroundColor: colorPalette[idx % colorPalette.length]
  }));

  charts['globalGradePrevalenceChart'] = new Chart(gradeCtx, {
    type: 'bar',
    data: {
      labels: data.gradePrevalence.grades,
      datasets: gradeDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: 'Behavior Prevalence by Grade Level' } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });

  // 4. Time of Day (8:00 - 3:30, 15m intervals)
  const timeLabels = Array.from({length: 31}, (_, i) => {
    const mins = i * 15;
    const h = 8 + Math.floor(mins / 60);
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  });

  const timeCtx = document.getElementById('globalTimeOfDayChart').getContext('2d');
  charts['globalTimeOfDayChart'] = new Chart(timeCtx, {
    type: 'bar',
    data: {
      labels: timeLabels,
      datasets: [{ label: 'All Incidents across Day (8:00 - 3:30)', data: data.timeBins, backgroundColor: '#ec4899' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
