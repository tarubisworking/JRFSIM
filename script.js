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

// Load Data
async function init() {
    try {
        const response = await fetch('questions.json');
        allQuestions = await response.json();
        populateFilters();
        updateDashboard();
    } catch (e) {
        console.error("Failed to load questions.json", e);
        document.getElementById('question-text').innerText = "Error loading database. Ensure questions.json exists.";
    }
}

// Setup Filters
function populateFilters() {
    const topics = new Set();
    const years = new Set();
    
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

// Update LocalStorage Stats
function updateDashboard() {
    const total = userStats.totalAttempted;
    const correct = userStats.totalCorrect;
    const acc = total === 0 ? 0 : Math.round((correct / total) * 100);
    
    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-accuracy').innerText = `${acc}%`;
    document.getElementById('nav-accuracy').innerText = `${acc}%`;
    document.getElementById('nav-completed').innerText = total;

    let weakest = "N/A";
    let lowestAcc = 100;
    for (const [topic, data] of Object.entries(userStats.topicStats)) {
        if (data.attempted >= 5) {
            let tAcc = (data.correct / data.attempted) * 100;
            if (tAcc < lowestAcc) {
                lowestAcc = tAcc;
                weakest = topic;
            }
        }
    }
    document.getElementById('stat-weak').innerText = weakest;
}

// Start Session
document.getElementById('start-btn').addEventListener('click', () => {
    const topic = document.getElementById('topic-select').value;
    const year = document.getElementById('year-select').value;
    const focus = document.getElementById('focus-select').value;

    sessionQuestions = allQuestions.filter(q => {
        let match = true;
        if (topic !== 'all' && q.topic !== topic) match = false;
        if (year !== 'all' && `${q.year} - ${q.session}` !== year) match = false;
        if (focus === 'incorrect' && !userStats.incorrectIds.includes(q.id)) match = false;
        return match;
    });

    if (sessionQuestions.length === 0) {
        alert("No questions match these filters!");
        return;
    }

    sessionQuestions.sort(() => Math.random() - 0.5); // Shuffle

    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
    document.getElementById('quiz-container').classList.add('flex', 'flex-col');
    
    currentIdx = 0;
    sessionScore = 0;
    loadQuestion();
});

// Load Single Question
function loadQuestion() {
    clearInterval(timerInterval);
    isAnswered = false;
    timeLeft = 30; // Reset timer to 30 seconds

    const q = sessionQuestions[currentIdx];
    
    document.getElementById('question-counter').innerText = `Question ${currentIdx + 1} of ${sessionQuestions.length}`;
    document.getElementById('question-meta').innerText = `${q.session} ${q.year} | ${q.topic}`;
    document.getElementById('question-text').innerText = q.question;
    
    // Reset UI Elements
    document.getElementById('explanation-box').classList.add('hidden');
    document.getElementById('action-bar').classList.add('hidden');
    const timeDisp = document.getElementById('timer-display');
    timeDisp.innerText = `${timeLeft}s`;
    timeDisp.classList.remove('text-red-500', 'animate-pulse');
    
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

    // Start Timer
    timerInterval = setInterval(() => {
        timeLeft--;
        timeDisp.innerText = `${timeLeft}s`;
        
        if (timeLeft <= 5) {
            timeDisp.classList.add('text-red-500', 'animate-pulse');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleAnswer(-1); // -1 means timeout/no answer selected
        }
    }, 1000);
}

// Handle Answer Logic
function handleAnswer(selectedIdx) {
    if (isAnswered) return;
    isAnswered = true;
    clearInterval(timerInterval);

    const q = sessionQuestions[currentIdx];
    const isCorrect = selectedIdx === q.answer;
    const isTimeout = selectedIdx === -1;
    
    // Update LocalStorage Stats
    userStats.totalAttempted++;
    if (!userStats.topicStats[q.topic]) {
        userStats.topicStats[q.topic] = { attempted: 0, correct: 0 };
    }
    userStats.topicStats[q.topic].attempted++;

    if (isCorrect) {
        sessionScore++;
        userStats.totalCorrect++;
        userStats.topicStats[q.topic].correct++;
        userStats.incorrectIds = userStats.incorrectIds.filter(id => id !== q.id);
    } else {
        if (!userStats.incorrectIds.includes(q.id)) {
            userStats.incorrectIds.push(q.id);
        }
    }
    
    localStorage.setItem('ugcStats', JSON.stringify(userStats));
    updateDashboard();

    // UI Feedback for Options
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach((btn, idx) => {
        btn.disabled = true; // Disable clicking
        
        if (idx === q.answer) {
            btn.classList.add('option-correct'); // Highlight correct answer green
        } else if (idx === selectedIdx && !isCorrect) {
            btn.classList.add('option-wrong'); // Highlight clicked wrong answer red
        } else {
            btn.classList.add('option-fade'); // Fade out others
        }
    });

    // Show Explanation if Wrong or Timeout
    if (!isCorrect) {
        const expBox = document.getElementById('explanation-box');
        const expText = document.getElementById('explanation-text');
        
        // If your JSON has an explanation, use it. Otherwise, generate a brief standard one.
        let explanationString = q.explanation || `The correct answer is "${q.options[q.answer]}".`;
        
        if (isTimeout) {
            expText.innerHTML = `⏳ <strong>Time's up!</strong> ${explanationString}`;
        } else {
            expText.innerHTML = `💡 <strong>Incorrect.</strong> ${explanationString}`;
        }
        
        expBox.classList.remove('hidden');
    }

    document.getElementById('action-bar').classList.remove('hidden');
}

// Next / End Logic
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

// Boot up
init();