const resultsDiv = document.getElementById('results');
const deptList = document.getElementById('deptList');

// 1. Fetch EVERY department from the Python scraper on load
async function loadAllDepartments() {
    deptList.innerHTML = '<p class="p-4 text-xs animate-pulse">Loading Departments...</p>';
    try {
        const response = await fetch('http://127.0.0.1:5000/departments');
        const depts = await response.json();
        
        deptList.innerHTML = ''; // Clear loading text
        depts.forEach(d => {
            const btn = document.createElement('button');
            btn.className = "w-full text-left px-4 py-2 hover:bg-blue-100 text-sm rounded transition border-b border-slate-50";
            btn.innerText = d;
            btn.onclick = () => fetchCourses(d);
            deptList.appendChild(btn);
        });
    } catch (e) {
        deptList.innerHTML = '<p class="p-4 text-xs text-red-500">Python Server Offline</p>';
    }
}

// 2. Fetch specific courses
async function fetchCourses(dept) {
    const term = document.getElementById('term').value;
    resultsDiv.innerHTML = `<div class="p-10 text-center">
        <div class="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
        <p class="font-bold text-blue-900">Scraping every ${dept} course from TritonLink...</p>
    </div>`;
    
    try {
        const response = await fetch(`http://127.0.0.1:5000/scrape?term=${term}&dept=${dept}`);
        const data = await response.json();
        
        if (data.length === 0) {
            resultsDiv.innerHTML = '<p class="p-10 text-slate-400">No courses found for this term. Try a different Quarter.</p>';
            return;
        }

        resultsDiv.innerHTML = '';
        data.forEach(course => {
            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex justify-between items-center mb-4";
            card.innerHTML = `
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">${course.id}</span>
                        <h3 class="font-bold text-slate-800">${course.name}</h3>
                    </div>
                    <p class="text-sm text-slate-600">${course.days} | ${course.time} | ${course.location}</p>
                    <div class="flex gap-4 items-center mt-2">
                        <span class="text-xs font-medium text-slate-500">Prof: ${course.prof}</span>
                        <a href="https://www.ratemyprofessors.com/search/professors/1107?q=${course.prof}" target="_blank" class="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold hover:bg-yellow-200">RMP ⭐</a>
                    </div>
                </div>
                <button onclick="addToMock('${course.id}', '${course.days}', '${course.time}')" class="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition">+ Add</button>
            `;
            resultsDiv.appendChild(card);
        });
    } catch (e) {
        resultsDiv.innerHTML = '<p class="text-red-500 p-10 font-bold">Error: Python script is not responding. Ensure app.py is running at localhost:5000.</p>';
    }
}

// Start loading depts immediately
loadAllDepartments();

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}