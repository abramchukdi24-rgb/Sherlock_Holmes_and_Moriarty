let sceneData = null;
let currentStep = 0;
let currentState = 'intro_steps';

let isTyping = false;
let typingTimeout = null;

// 1. ЗАГРУЗКА ДАННЫХ
async function loadScene() {
    const response = await fetch('/api/scene?scene_id=1');
    sceneData = await response.json();
    render();
}

// 2. ГЛАВНЫЙ РЕНДЕР (Рисуем всё)
function render() {
    const step = sceneData[currentState][currentStep];
    const gameScreen = document.getElementById('game-screen');

    // --- ЛОГИКА ЗАСТАВКИ (TITLE SCREEN) ---
    if (step.is_title_screen) {
        gameScreen.classList.add('title-mode');
    } else {
        gameScreen.classList.remove('title-mode');
    }

    // --- ЛОГИКА ФОНА ---
    if (!step.is_title_screen) {
        const bgFile = step.background || sceneData.background;
        document.getElementById('bg-layer').style.backgroundImage = `url('/static/images/backgrounds/${bgFile}')`;
    }

    // --- ЛОГИКА ПЕРСОНАЖА ---
    const charImg = document.getElementById('char-img');
    if (step.character && !step.is_title_screen) {
        charImg.src = `/static/images/characters/${step.character}.png`;
        charImg.style.display = 'block';
    } else {
        charImg.style.display = 'none';
    }

    // --- ЗАПУСК ПЕЧАТНОЙ МАШИНКИ ---
    typeWriter(step.text);
}

// 3. ФУНКЦИЯ ПЕЧАТНОЙ МАШИНКИ
function typeWriter(text) {
    const textElement = document.getElementById('main-dialogue');
    clearTimeout(typingTimeout);
    textElement.innerText = ""; 
    isTyping = true;
    
    let i = 0;
    const speed = 25; // Скорость печати

    function type() {
        if (i < text.length) {
            textElement.innerText += text.charAt(i);
            i++;
            typingTimeout = setTimeout(type, speed);
        } else {
            isTyping = false;
        }
    }
    type();
}

// 4. ЛОГИКА КЛИКА (Листание и пропуск анимации)
document.getElementById('click-overlay').addEventListener('click', () => {
    const step = sceneData[currentState][currentStep];

    // Если текст еще печатается — при клике показываем его СРАЗУ
    if (isTyping) {
        clearTimeout(typingTimeout);
        document.getElementById('main-dialogue').innerText = step.text;
        isTyping = false;
        return; 
    }

    // Если мы на последнем шаге Интро и есть ТЕЛЕФОН
    if (currentState === 'intro_steps' && currentStep === sceneData.intro_steps.length - 1 && sceneData.phone_trigger) {
        showPhoneUI();
        return;
    }

    // Листаем дальше
    if (currentStep < sceneData[currentState].length - 1) {
        currentStep++;
        render();
    } else {
        // Переход между блоками (Интро -> Диалоги)
        if (currentState === 'intro_steps') {
            currentState = 'dialogue_steps';
            currentStep = 0;
            render();
        } 
        // Если кончились Диалоги — проверяем Выбор
        else if (currentState === 'dialogue_steps' && sceneData.search_interact) {
            showChoicesUI();
        }
    }
});

// 5. ИНТЕРФЕЙС ТЕЛЕФОНА
function showPhoneUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = `
        <!-- Добавляем специальный класс pos-phone -->
        <div class="phone-trigger-wrapper pos-phone">
            <div class="phone-arrow"></div>
            <button class="phone-custom-btn">
                ${sceneData.phone_trigger.prompt}
            </button>
        </div>
    `;

    overlay.querySelector('.phone-custom-btn').onclick = () => {
        overlay.innerHTML = "";
        currentState = 'dialogue_steps';
        currentStep = 0;
        render();
    };
}

// 6. ИНТЕРФЕЙС ВЫБОРА (Стол, Шкаф, Дверь)
function showChoicesUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = "";
    
    sceneData.search_interact.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-exit';
        btn.style.width = "500px";
        btn.style.marginBottom = "15px";
        btn.innerText = choice.text;
        
        btn.onclick = () => {
            alert(choice.result_text);
            // Сюда потом добавим переход к следующей сцене
        };
        overlay.appendChild(btn);
    });
}

function showChoicesUI() {
    const overlay = document.getElementById('choices-overlay');
    overlay.innerHTML = ""; // Очищаем

    sceneData.search_interact.choices.forEach(choice => {
        // Создаем обертку для каждой интерактивной точки
        const wrapper = document.createElement('div');
        
        // Даем ей класс враппера + уникальный класс для позиции (например, pos-table)
        wrapper.className = `phone-trigger-wrapper pos-${choice.id}`;
        
        // Определяем тип стрелки (для двери - вправо, для остальных - вниз)
        const arrowClass = (choice.id === 'door') ? 'phone-arrow arrow-right' : 'phone-arrow';

        wrapper.innerHTML = `
            <div class="${arrowClass}"></div>
            <button class="phone-custom-btn">${choice.text}</button>
        `;

        // Клик отправляет выбор на бэк
        wrapper.querySelector('.phone-custom-btn').onclick = () => {
            handleSearchAction(choice.id);
        };

        overlay.appendChild(wrapper);
    });
}


// Функция для отправки действия на сервер
async function handleSearchAction(actionId) {
    const response = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId })
    });
    
    const result = await response.json();

    if (result.status === 'win') {
        window.location.href = '/tasks'; 
    } else {
        alert(result.text + "\nШтраф! Осталось времени: " + result.time_left);
    }
}

loadScene();

