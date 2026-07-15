// Функция для загрузки сцены по ID
async function loadScene(sceneId) {
    const response = await fetch(`/api/scene?scene_id=${sceneId}`);
    const data = await response.json();
    
    render(data);
}

function render(data) {
    // 1. Установка фона
    const bg = document.getElementById('bg-layer');
    bg.style.backgroundImage = `url('/static/images/${data.background}')`;

    // 2. Установка текста (берем первый текст из intro_steps)
    const textBox = document.getElementById('main-text');
    textBox.innerText = data.intro_steps[0].text;

    // 3. Установка персонажа
    const charImg = document.getElementById('character-img');
    if (data.intro_steps[0].character) {
        charImg.src = `/static/images/${data.intro_steps[0].character}.png`;
        charImg.style.display = 'block';
    } else {
        charImg.style.display = 'none';
    }
}

// Запускаем загрузку первой сцены
loadScene(1);