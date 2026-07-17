let sceneData = null;
let currentStep = 0;
let currentState = 'intro_steps';
let isTyping = false;
let typingTimeout = null;
let searchTimerInterval = null;
let searchTimeSeconds = 0;

async function loadScene() {
    const urlParams = new URLSearchParams(window.location.search);
    let sceneId = urlParams.get('scene_id') || 1; 
    let secondsFromUrl = urlParams.get('seconds');
    if (secondsFromUrl) searchTimeSeconds = parseInt(secondsFromUrl);

    const response = await fetch(`/api/scene?scene_id=${sceneId}`);
    sceneData = await response.json();
    
    currentStep = 0; 
    if (sceneData.intro_steps && sceneData.intro_steps.length > 0) {
        currentState = 'intro_steps';
    } else {
        currentState = 'dialogue_steps';
    }

    render();

    // Если это результат (2, 4, 6)
    if (sceneId % 2 === 0 && searchTimeSeconds > 0) {
        startSearchTimer(false); 
    }
}

function render() {
    const step = sceneData[currentState][currentStep];
    const gameScreen = document.getElementById('game-screen');

    if (step.is_title_screen) gameScreen.classList.add('title-mode');
    else gameScreen.classList.remove('title-mode');

    if (!step.is_title_screen) {
        const bgFile = step.background || sceneData.background;
        document.getElementById('bg-layer').style.backgroundImage = `url('/static/images/backgrounds/${bgFile}')`;
    }

    const charImg = document.getElementById('char-img');
    if (step.character && !step.is_title_screen) {
        charImg.src = `/static/images/characters/${step.character}.png`;
        charImg.style.display = 'block';
    } else {
        charImg.style.display = 'none';
    }

    typeWriter(step.text);

    // ПРОВЕРКА УВЕДОМЛЕНИЙ ОТ БЭКЕНДА
    if (sceneData.system_notification) {
        showSystemMessage(sceneData.system_notification);
        sceneData.system_notification = null;
    }
}

function typeWriter(text) {
    const textElement = document.getElementById('main-dialogue');
    clearTimeout(typingTimeout);
    textElement.innerText = ""; 
    isTyping = true;
    let i = 0;
    function type() {
        if (i < text.length) {
            textElement.innerText += text.charAt(i);
            i++;
            typingTimeout = setTimeout(type, 25);
        } else isTyping = false;
    }
    type();
}

function showSystemMessage(text, callback) {
    const overlay = document.getElementById('system-notification');
    document.getElementById('notification-text').innerText = text.toUpperCase();
    overlay.style.display = 'flex';
    document.getElementById('close-notification').onclick = () => {
        overlay.style.display = 'none';
        if (callback) callback();
    };
}

document.getElementById('click-overlay').addEventListener('click', () => {
    if (isTyping) {
        clearTimeout(typingTimeout);
        document.getElementById('main-dialogue').innerText = sceneData[currentState][currentStep].text;
        isTyping = false;
        return; 
    }

    if (currentState === 'intro_steps' && currentStep === sceneData.intro_steps.length - 1 && sceneData.phone_trigger) {
        showPhoneUI();
        return;
    }

    if (currentStep < sceneData[currentState].length - 1) {
        currentStep++;
        render();
    } else {
        if (currentState === 'intro_steps' && sceneData.dialogue_steps) {
            currentState = 'dialogue_steps';
            currentStep = 0;
            render();
        } else if (sceneData.search_interact && currentState !== 'search_mode') {
            showSearchUI();
            currentState = 'search_mode';
        } else if (currentState !== 'search_mode') {
            handleEndOfScene();
        }
    }
});

function handleEndOfScene() {
    const urlParams = new URLSearchParams(window.location.search);
    const sceneId = parseInt(urlParams.get('scene_id') || "1");
    let msg = (sceneId === 2 && searchTimeSeconds <= 0) ? "ВЫ НЕ УСПЕЛИ..." : "ВЫ НАШЛИ ЛИСТОК БУМАГИ!";
    
    showSystemMessage(msg, () => {
        window.location.href = `/game?scene_id=${sceneId + 1}&seconds=${searchTimeSeconds}`;
    });
}

// Остальные функции (Timer, UI) остаются как были
function startSearchTimer(reset = true) {
    const timerBlock = document.getElementById('search-timer-block');
    if (timerBlock) timerBlock.style.display = 'flex';
    if (reset) searchTimeSeconds = (sceneData.current_time_left || 40) * 60;
    if (searchTimerInterval) clearInterval(searchTimerInterval);
    searchTimerInterval = setInterval(() => {
        if (searchTimeSeconds > 0) { searchTimeSeconds--; updateSearchTimerDisplay(); }
        else { clearInterval(searchTimerInterval); window.location.href = `/game?scene_id=${sceneData.scene_id}&seconds=0`; }
    }, 1000);
}
function updateSearchTimerDisplay() {
    const timerDisplay = document.getElementById('game-timer-display');
    if (!timerDisplay) return;
    const minutes = Math.floor(searchTimeSeconds / 60);
    let seconds = searchTimeSeconds % 60;
    if (seconds < 10) seconds = '0' + seconds;
    timerDisplay.innerText = `${minutes}:${seconds}`;
}
function showPhoneUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = `<div class="phone-trigger-wrapper pos-phone"><div class="phone-arrow"></div><button class="phone-custom-btn">${sceneData.phone_trigger.prompt}</button></div>`;
    overlay.querySelector('.phone-custom-btn').onclick = () => { overlay.innerHTML = ""; currentState = 'dialogue_steps'; currentStep = 0; render(); };
}
function showSearchUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = "";
    if (searchTimeSeconds <= 0) startSearchTimer(true);
    sceneData.search_interact.choices.forEach(choice => {
        const wrapper = document.createElement('div');
        wrapper.className = `phone-trigger-wrapper pos-${choice.id}`;
        const arrowClass = (choice.id === 'door') ? 'phone-arrow arrow-right' : 'phone-arrow';
        wrapper.innerHTML = `<div class="${arrowClass}"></div><button class="phone-custom-btn">${choice.text}</button>`;
        wrapper.querySelector('.phone-custom-btn').onclick = () => handleSearchAction(choice.id);
        overlay.appendChild(wrapper);
    });
}
async function handleSearchAction(actionId) {
    const response = await fetch('/api/game/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action_id: actionId }) });
    const result = await response.json();
    if (result.status === 'win') { clearInterval(searchTimerInterval); window.location.href = `/tasks?seconds=${searchTimeSeconds}`; }
    else {
        document.getElementById('main-dialogue').innerText = result.text;
        searchTimeSeconds = Math.max(0, searchTimeSeconds - 300);
        updateSearchTimerDisplay();
        const penalty = document.getElementById('game-penalty-popup');
        if (penalty) { penalty.classList.add('penalty-animation'); setTimeout(() => penalty.classList.remove('penalty-animation'), 2000); }
    }
}
loadScene();