// ==========================================
// 1. ADD YOUR NEW JSON FILES HERE
// ==========================================
const databaseFiles = [
    'questions.json',
    'questions2.json',
    'questions3.json',
    // Example: Add your next files like this:
    // 'question2.json',
    // 'question3.json'
];

// ==========================================
// 2. GLOBAL VARIABLES & STATE
// ==========================================
let allQuestions = [];
let sessionQuestions = [];
let currentIdx = 0;
let sessionScore = 0;
let userStats = JSON.parse(localStorage.getItem('ugcStats')) || {
    totalAttempted: 0,
    totalCorrect: 0,
    topicStats: {},
    incorrectIds: []
};
let timerInterval;
let timeLeft = 30;
let isAnswered = false;

// ==========================================
// 3. INITIALIZATION & FILE LOADING
// ==========================================
async function init() {
    try {
        // Fetch all files simultaneously
        const fetchPromises = databaseFiles.map(file => fetch(file).then(res => res.json()));
        const dataArrays = await Promise.all(fetchPromises);
        
        // Merge all individual arrays into one master array
        allQuestions = dataArrays.flat();
        
        populateFilters();
        updateDashboard();
    } catch (e) {
        console.error("Failed to load databases", e);
        document.getElementById('question-text').innerText = "Error loading databases. Ensure all JSON file names in script.js are spelled correctly and exist in your folder.";
    }
}

// ==========================================
// 4. SIDEBAR FILTER SETUP
// ==========================================
function populateFilters() {
    const topics = new Set();
    const years = new Set();
    
    // Assign unique IDs to questions for tracking incorrect answers
    allQuestions.forEach((q, i) => {
        q.id = `${q.year}-${q.session}-${q.questionNumber}-${i}`;
        topics.add(q.topic);
        years.add(`${q.year} - ${q.session}`);
    });

    const topicSelect = document.getElementById('topic-select');
    topics.forEach(t => topicSelect.add(new Option(t, t)));

    const yearSelect = document.getElementById('year-select');
    years.forEach(y => yearSelect.add(new Option(y, y)));
}

// ==========================================
// 5. LIFETIME STATISTICS & DASHBOARD
// ==========================================
function updateDashboard() {
    const total = userStats.totalAttempted;
    const correct = userStats.totalCorrect;
    const acc = total === 0 ? 0 : Math.round((correct / total) * 100);
    
    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-accuracy').innerText = `${acc}%`;
    document.getElementById('nav-accuracy').innerText = `${acc}%`;
    document.getElementById('nav-completed').innerText = total;

    // Calculate weakest topic
    let weakest = "N/A";
    let lowestAcc = 100;
    for (const [topic, data] of Object.entries(userStats.topicStats)) {
        if (data.attempted >= 5) { // Minimum 5 attempts required to measure
            let tAcc = (data.correct / data.attempted) * 100;
            if (tAcc < lowestAcc) {
                lowestAcc = tAcc;
                weakest = topic;
            }
        }
    }
    document.getElementById('stat-weak').innerText = weakest;
}

// ==========================================
// 6. START QUIZ SESSION
// ==========================================
document.getElementById('start-btn').addEventListener('click', () => {
    const topic = document.getElementById('topic-select').value;
    const year = document.getElementById('year-select').value;
    const focus = document.getElementById('focus-select').value;

    // Filter the master database based on sidebar selections
    sessionQuestions = allQuestions.filter(q => {
        let match = true;
        if (topic !== 'all' && q.topic !== topic) match = false;
        if (year !== 'all' && `${q.year} - ${q.session}` !== year) match = false;
        if (focus === 'incorrect' && !userStats.incorrectIds.includes(q.id)) match = false;
        return match;
    });

    if (sessionQuestions.length === 0) {
        alert("No questions match these filters! Try changing your selection.");
        return;
    }

    // Shuffle the filtered questions
    sessionQuestions.sort(() => Math.random() - 0.5);

    // Swap UI panels
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
    document.getElementById('quiz-container').classList.add('flex', 'flex-col');
    
    currentIdx = 0;
    sessionScore = 0;
    loadQuestion();
});

// ==========================================
// 7. LOAD INDIVIDUAL QUESTION & TIMER
// ==========================================
function loadQuestion() {
    clearInterval(timerInterval);
    isAnswered = false;
    timeLeft = 30; // Reset strict 30-second timer

    const q = sessionQuestions[currentIdx];
    
    // Update Header Meta Data
    document.getElementById('question-counter').innerText = `Question ${currentIdx + 1} of ${sessionQuestions.length}`;
    document.getElementById('question-meta').innerText = `${q.session} ${q.year} | ${q.topic}`;
    document.getElementById('question-text').innerText = q.question;
    
    // Reset Explanations and Actions
    document.getElementById('explanation-box').classList.add('hidden');
    document.getElementById('action-bar').classList.add('hidden');
    
    // Reset Timer Display
    const timeDisp = document.getElementById('timer-display');
    timeDisp.innerText = `${timeLeft}s`;
    timeDisp.classList.remove('text-red-500', 'animate-pulse');
    
    // Render Options
    const optsContainer = document.getElementById('options-container');
    optsContainer.innerHTML = '';
    
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.id = `opt-${idx}`;
        btn.innerText = opt;
        btn.onclick = () => handleAnswer(idx);
        optsContainer.appendChild(btn);
    });

    // Start 30-Second Countdown
    timerInterval = setInterval(() => {
        timeLeft--;
        timeDisp.innerText = `${timeLeft}s`;
        
        // Visual warning at 5 seconds
        if (timeLeft <= 5) {
            timeDisp.classList.add('text-red-500', 'animate-pulse');
        }

        // Timeout Trigger
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleAnswer(-1); // -1 triggers the timeout / incorrect logic
        }
    }, 1000);
}

// ==========================================
// 8. ANSWER EVALUATION & FEEDBACK
// ==========================================
function handleAnswer(selectedIdx) {
    if (isAnswered) return; // Prevent double-clicking
    isAnswered = true;
    clearInterval(timerInterval);

    const q = sessionQuestions[currentIdx];
    const isCorrect = selectedIdx === q.answer;
    const isTimeout = selectedIdx === -1;
    
    // Track Stats
    userStats.totalAttempted++;
    if (!userStats.topicStats[q.topic]) {
        userStats.topicStats[q.topic] = { attempted: 0, correct: 0 };
    }
    userStats.topicStats[q.topic].attempted++;

    if (isCorrect) {
        sessionScore++;
        userStats.totalCorrect++;
        userStats.topicStats[q.topic].correct++;
        // Remove from weak list if answered correctly
        userStats.incorrectIds = userStats.incorrectIds.filter(id => id !== q.id);
    } else {
        // Add to weak list if wrong
        if (!userStats.incorrectIds.includes(q.id)) {
            userStats.incorrectIds.push(q.id);
        }
    }
    
    // Save to browser
    localStorage.setItem('ugcStats', JSON.stringify(userStats));
    updateDashboard();

    // Color Code Options
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach((btn, idx) => {
        btn.disabled = true; // Lock all buttons
        
        if (idx === q.answer) {
            btn.classList.add('option-correct'); // Highlight correct answer
        } else if (idx === selectedIdx && !isCorrect) {
            btn.classList.add('option-wrong'); // Highlight chosen wrong answer
        } else {
            btn.classList.add('option-fade'); // Fade out the rest
        }
    });

    // Handle Explanation Popup
    if (!isCorrect) {
        const expBox = document.getElementById('explanation-box');
        const expText = document.getElementById('explanation-text');
        
        // Dynamically pull explanation if it exists, otherwise state correct answer
        let explanationString = q.explanation || `The correct answer is "${q.options[q.answer]}".`;
        
        if (isTimeout) {
            expText.innerHTML = `⏳ <strong>Time's up!</strong> ${explanationString}`;
        } else {
            expText.innerHTML = `💡 <strong>Incorrect.</strong> ${explanationString}`;
        }
        
        expBox.classList.remove('hidden');
    }

    // Reveal Next Button
    document.getElementById('action-bar').classList.remove('hidden');
}

// ==========================================
// 9. NAVIGATION & END SESSION
// ==========================================
document.getElementById('next-btn').addEventListener('click', () => {
    currentIdx++;
    if (currentIdx >= sessionQuestions.length) {
        endSession();
    } else {
        loadQuestion();
    }
});

document.getElementById('end-btn').addEventListener('click', endSession);

function endSession() {
    document.getElementById('quiz-container').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('flex');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('session-score').innerText = `${sessionScore} / ${currentIdx + 1}`;
}

// ==========================================
// 10. SYSTEM BOOT
// ==========================================
init();
